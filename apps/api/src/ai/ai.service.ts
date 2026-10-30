import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReportingService } from '../reporting/reporting.service';

export interface AIQueryRequest {
  query: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AIQueryResponse {
  query: string;
  intent: string;
  data: Record<string, unknown>;
  summary: string;
  generatedAt: string;
}

type QueryIntent =
  | 'sales_summary'
  | 'inventory_status'
  | 'top_products'
  | 'store_comparison'
  | 'low_stock_alert'
  | 'unknown';

@Injectable()
export class AIService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportingService: ReportingService,
  ) {}

  async processQuery(tenantId: string, request: AIQueryRequest): Promise<AIQueryResponse> {
    const intent = this.classifyIntent(request.query);

    let data: Record<string, unknown> = {};
    let summary = '';

    switch (intent) {
      case 'sales_summary': {
        const now = new Date();
        const startDate = request.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = request.endDate || now.toISOString().split('T')[0];
        const result = await this.reportingService.getSalesSummary(tenantId, {
          storeId: request.storeId,
          startDate,
          endDate,
        });
        data = result as unknown as Record<string, unknown>;
        summary = `Sales summary for ${startDate} to ${endDate}: ${result.totalSales} sales, total revenue ${result.totalRevenue}.`;
        break;
      }
      case 'inventory_status': {
        const result = await this.reportingService.getInventoryReport(tenantId, {
          storeId: request.storeId,
        });
        data = result as unknown as Record<string, unknown>;
        summary = `Inventory report: ${result.totalItems} items tracked, ${result.lowStockCount} low stock, ${result.outOfStockCount} out of stock.`;
        break;
      }
      case 'top_products': {
        const now = new Date();
        const startDate = request.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = request.endDate || now.toISOString().split('T')[0];
        const result = await this.reportingService.getSalesSummary(tenantId, {
          storeId: request.storeId,
          startDate,
          endDate,
        });
        data = { topProducts: result.topProducts };
        summary = `Top ${result.topProducts.length} products by revenue for ${startDate} to ${endDate}.`;
        break;
      }
      case 'store_comparison': {
        const now = new Date();
        const startDate = request.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = request.endDate || now.toISOString().split('T')[0];
        const result = await this.reportingService.getStoreComparison(tenantId, startDate, endDate);
        data = result as unknown as Record<string, unknown>;
        summary = `Store comparison for ${startDate} to ${endDate}: ${result.stores.length} stores analyzed.`;
        break;
      }
      case 'low_stock_alert': {
        const result = await this.reportingService.getInventoryReport(tenantId, {
          storeId: request.storeId,
          lowStockThreshold: 10,
        });
        data = {
          lowStockItems: result.lowStockItems,
          outOfStockItems: result.outOfStockItems,
        };
        summary = `Stock alert: ${result.lowStockCount} items low on stock, ${result.outOfStockCount} out of stock.`;
        break;
      }
      default: {
        data = { message: 'Unable to determine query intent. Try asking about sales, inventory, or store performance.' };
        summary = 'Query not recognized. Supported queries: sales summary, inventory status, top products, store comparison, low stock alerts.';
      }
    }

    return {
      query: request.query,
      intent,
      data,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  private classifyIntent(query: string): QueryIntent {
    const lower = query.toLowerCase();

    if (lower.includes('sales') || lower.includes('revenue') || lower.includes('orders')) {
      return 'sales_summary';
    }
    if (lower.includes('inventory') || lower.includes('stock level')) {
      return 'inventory_status';
    }
    if (lower.includes('top product') || lower.includes('best selling') || lower.includes('popular')) {
      return 'top_products';
    }
    if (lower.includes('store comparison') || lower.includes('compare store') || lower.includes('store performance')) {
      return 'store_comparison';
    }
    if (lower.includes('low stock') || lower.includes('out of stock') || lower.includes('stock alert')) {
      return 'low_stock_alert';
    }

    return 'unknown';
  }
}
