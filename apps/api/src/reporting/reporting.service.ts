import {
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface SalesSummaryQuery {
  storeId?: string;
  storeIds?: string[];
  startDate: string;
  endDate: string;
}

export interface InventoryReportQuery {
  storeId?: string;
  storeIds?: string[];
  lowStockThreshold?: number;
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(tenantId: string, query: SalesSummaryQuery) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const where: Prisma.SaleWhereInput = {
      tenantId,
      status: 'COMPLETED',
      createdAt: { gte: startDate, lte: endDate },
      ...(query.storeId
        ? { storeId: query.storeId }
        : query.storeIds
          ? { storeId: { in: query.storeIds } }
          : {}),
    };

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        payments: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const totalRevenue = sales.reduce(
      (sum, s) => sum.add(s.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalTax = sales.reduce(
      (sum, s) => sum.add(s.taxAmount),
      new Prisma.Decimal(0),
    );
    const totalDiscount = sales.reduce(
      (sum, s) => sum.add(s.discountAmount),
      new Prisma.Decimal(0),
    );

    // Group by store
    const byStore = new Map<string, { storeName: string; storeCode: string; revenue: Prisma.Decimal; count: number }>();
    for (const sale of sales) {
      const key = sale.storeId;
      const existing = byStore.get(key);
      if (existing) {
        existing.revenue = existing.revenue.add(sale.totalAmount);
        existing.count += 1;
      } else {
        byStore.set(key, {
          storeName: sale.store.name,
          storeCode: sale.store.code,
          revenue: sale.totalAmount,
          count: 1,
        });
      }
    }

    // Group by payment method
    const byPaymentMethod = new Map<string, Prisma.Decimal>();
    for (const sale of sales) {
      for (const payment of sale.payments) {
        const current = byPaymentMethod.get(payment.paymentMethod) ?? new Prisma.Decimal(0);
        byPaymentMethod.set(payment.paymentMethod, current.add(payment.amount));
      }
    }

    // Top products
    const productSales = new Map<string, { sku: string; name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.productId;
        const existing = productSales.get(key);
        if (existing) {
          existing.quantity = existing.quantity.add(item.quantity);
          existing.revenue = existing.revenue.add(item.totalPrice);
        } else {
          productSales.set(key, {
            sku: item.product.sku,
            name: item.product.name,
            quantity: item.quantity,
            revenue: item.totalPrice,
          });
        }
      }
    }

    const topProducts = Array.from(productSales.entries())
      .map(([id, data]) => ({ productId: id, ...data }))
      .sort((a, b) => b.revenue.comparedTo(a.revenue))
      .slice(0, 10);

    return {
      period: { startDate, endDate },
      totalSales: sales.length,
      totalRevenue: totalRevenue.toString(),
      totalTax: totalTax.toString(),
      totalDiscount: totalDiscount.toString(),
      averageOrderValue: sales.length > 0 ? totalRevenue.div(sales.length).toString() : '0',
      byStore: Array.from(byStore.entries()).map(([storeId, data]) => ({
        storeId,
        ...data,
        revenue: data.revenue.toString(),
      })),
      byPaymentMethod: Object.fromEntries(
        Array.from(byPaymentMethod.entries()).map(([k, v]) => [k, v.toString()]),
      ),
      topProducts: topProducts.map((p) => ({
        ...p,
        quantity: p.quantity.toString(),
        revenue: p.revenue.toString(),
      })),
    };
  }

  async getInventoryReport(tenantId: string, query: InventoryReportQuery) {
    const where: Prisma.InventoryBalanceWhereInput = {
      tenantId,
      ...(query.storeId
        ? { storeId: query.storeId }
        : query.storeIds
          ? { storeId: { in: query.storeIds } }
          : {}),
    };

    const balances = await this.prisma.inventoryBalance.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, sku: true, name: true, baseUnit: true } },
      },
      orderBy: [{ product: { name: 'asc' } }],
    });

    const threshold = query.lowStockThreshold ?? 10;
    const lowStock = balances.filter((b) => b.quantityOnHand.lte(threshold));
    const outOfStock = balances.filter((b) => b.quantityOnHand.lte(0));

    return {
      totalItems: balances.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      lowStockItems: lowStock.map((b) => ({
        storeId: b.storeId,
        storeName: b.store.name,
        productId: b.productId,
        productSku: b.product.sku,
        productName: b.product.name,
        quantityOnHand: b.quantityOnHand.toString(),
        quantityReserved: b.quantityReserved.toString(),
      })),
      outOfStockItems: outOfStock.map((b) => ({
        storeId: b.storeId,
        storeName: b.store.name,
        productId: b.productId,
        productSku: b.product.sku,
        productName: b.product.name,
      })),
      items: balances.map((b) => ({
        storeId: b.storeId,
        storeName: b.store.name,
        productId: b.productId,
        productSku: b.product.sku,
        productName: b.product.name,
        baseUnit: b.product.baseUnit,
        quantityOnHand: b.quantityOnHand.toString(),
        quantityReserved: b.quantityReserved.toString(),
      })),
    };
  }

  async getStoreComparison(
    tenantId: string,
    startDate: string,
    endDate: string,
    storeIds?: string[],
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const stores = await this.prisma.store.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(storeIds ? { id: { in: storeIds } } : {}),
      },
      select: { id: true, name: true, code: true },
    });

    const results = await Promise.all(
      stores.map(async (store) => {
        const sales = await this.prisma.sale.findMany({
          where: {
            tenantId,
            storeId: store.id,
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
          },
        });

        const revenue = sales.reduce(
          (sum, s) => sum.add(s.totalAmount),
          new Prisma.Decimal(0),
        );

        const inventoryCount = await this.prisma.inventoryBalance.count({
          where: { tenantId, storeId: store.id },
        });

        return {
          storeId: store.id,
          storeName: store.name,
          storeCode: store.code,
          totalSales: sales.length,
          totalRevenue: revenue.toString(),
          averageOrderValue: sales.length > 0 ? revenue.div(sales.length).toString() : '0',
          inventoryItemCount: inventoryCount,
        };
      }),
    );

    return {
      period: { startDate: start, endDate: end },
      stores: results.sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue)),
    };
  }
}
