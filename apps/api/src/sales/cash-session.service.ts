import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface OpenCashSessionInput {
  storeId: string;
  openingBalance: string;
}

export interface CloseCashSessionInput {
  closingBalance: string;
  notes?: string | null;
}

@Injectable()
export class CashSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async openSession(tenantId: string, actor: AuthenticatedUser, input: OpenCashSessionInput) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }
    const openingBalance = new Prisma.Decimal(input.openingBalance);
    if (openingBalance.lt(0)) {
      throw new BadRequestException('Opening balance cannot be negative.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.cashSession.findFirst({
            where: { tenantId, storeId: input.storeId, status: 'OPEN' },
          });
          if (existing) {
            throw new BadRequestException('An open cash session already exists for this store.');
          }

          const session = await tx.cashSession.create({
            data: {
              tenantId,
              storeId: input.storeId,
              openedByMembershipId: actor.membershipId,
              openingBalance,
              status: 'OPEN',
            },
          });
          await tx.auditLog.create({
            data: {
              tenantId,
              actorMembershipId: actor.membershipId,
              actorUserId: actor.id,
              action: 'cash_session.opened',
              resource: 'cash_session',
              resourceId: session.id,
              metadata: { storeId: input.storeId, openingBalance: openingBalance.toString() },
            },
          });
          return session;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const serializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!serializationConflict) throw error;
        if (attempt === 2) {
          throw new ConflictException('Cash session changed concurrently. Please retry.');
        }
      }
    }
    throw new ConflictException('Cash session could not be opened. Please retry.');
  }

  async closeSession(
    tenantId: string,
    sessionId: string,
    actor: AuthenticatedUser,
    input: CloseCashSessionInput,
  ) {
    const closingBalance = new Prisma.Decimal(input.closingBalance);
    if (closingBalance.lt(0)) {
      throw new BadRequestException('Closing balance cannot be negative.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.cashSession.findFirst({
          where: {
            id: sessionId,
            tenantId,
            status: 'OPEN',
            ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
          },
        });
        if (!session) {
          throw new NotFoundException('Open cash session not found.');
        }

        const closedAt = new Date();
        const sales = await tx.sale.findMany({
          where: {
            tenantId,
            storeId: session.storeId,
            createdAt: { gte: session.openedAt, lte: closedAt },
            status: 'COMPLETED',
          },
          include: { payments: true },
        });

        let expectedBalance = session.openingBalance;
        for (const sale of sales) {
          for (const payment of sale.payments) {
            if (payment.paymentMethod === 'CASH') {
              expectedBalance = expectedBalance.add(payment.amount);
            }
          }
        }
        const variance = closingBalance.sub(expectedBalance);

        const claim = await tx.cashSession.updateMany({
          where: {
            id: sessionId,
            tenantId,
            status: 'OPEN',
            ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
          },
          data: {
            status: 'CLOSED',
            closingBalance,
            expectedBalance,
            closedByMembershipId: actor.membershipId,
            closedAt,
          },
        });
        if (claim.count !== 1) {
          throw new ConflictException('Cash session has already been closed.');
        }

        const updated = await tx.cashSession.findUnique({ where: { id: sessionId } });
        if (!updated) throw new NotFoundException('Cash session not found.');
        await tx.auditLog.create({
          data: {
            tenantId,
            actorMembershipId: actor.membershipId,
            actorUserId: actor.id,
            action: 'cash_session.closed',
            resource: 'cash_session',
            resourceId: sessionId,
            metadata: {
              openingBalance: session.openingBalance.toString(),
              closingBalance: closingBalance.toString(),
              expectedBalance: expectedBalance.toString(),
              variance: variance.toString(),
            },
          },
        });
        return { ...updated, variance: variance.toString() };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Cash session changed concurrently. Refresh and retry.');
      }
      throw error;
    }
  }

  async getSession(tenantId: string, sessionId: string, storeIds?: string[]) {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        id: sessionId,
        tenantId,
        ...(storeIds ? { storeId: { in: storeIds } } : {}),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
      },
    });
    if (!session) {
      throw new NotFoundException('Cash session not found.');
    }
    return session;
  }

  async listSessions(
    tenantId: string,
    storeId?: string,
    status?: string,
    page = 1,
    pageSize = 25,
    storeIds?: string[],
  ) {
    const where: Prisma.CashSessionWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : storeIds ? { storeId: { in: storeIds } } : {}),
      ...(status ? { status } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashSession.findMany({
        where,
        include: { store: { select: { id: true, name: true, code: true } } },
        orderBy: [{ openedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.cashSession.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getCurrentSession(tenantId: string, storeId: string, storeIds?: string[]) {
    return this.prisma.cashSession.findFirst({
      where: {
        tenantId,
        storeId,
        status: 'OPEN',
        ...(storeIds ? { AND: [{ storeId: { in: storeIds } }] } : {}),
      },
      include: { store: { select: { id: true, name: true, code: true } } },
    });
  }
}
