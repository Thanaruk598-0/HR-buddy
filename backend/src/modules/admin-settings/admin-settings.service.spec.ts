import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminSettingsService } from './admin-settings.service';

describe('AdminSettingsService', () => {
  const prisma = {
    department: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    problemCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    vehicleIssueCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    operator: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const service = new AdminSettingsService(prisma as never);

  const createPrismaKnownError = (code: string) =>
    Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      {
        code,
      },
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds department list filters with search + active status', async () => {
    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', name: 'Human Resources', isActive: true },
    ]);

    const result = await service.listDepartments({
      q: '  Human  ',
      isActive: true,
    });

    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        name: {
          contains: 'Human',
          mode: 'insensitive',
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
    expect(result.items).toHaveLength(1);
  });

  it('normalizes department name before create', async () => {
    prisma.department.create.mockResolvedValue({
      id: 'dept-1',
      name: 'Human Resource',
      isActive: false,
    });

    await service.createDepartment({
      name: '  Human   Resource  ',
      isActive: false,
    });

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: {
        name: 'Human Resource',
        isActive: false,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
  });

  it('maps duplicate department name error to business code', async () => {
    prisma.department.create.mockRejectedValue(createPrismaKnownError('P2002'));

    try {
      await service.createDepartment({ name: 'HR' });
      fail('expected duplicate department error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'DEPARTMENT_NAME_EXISTS',
      });
    }
  });

  it('rejects department update with no updatable fields', async () => {
    try {
      await service.updateDepartment('dept-1', {});
      fail('expected update validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'NO_UPDATE_FIELDS',
      });
    }

    expect(prisma.department.findUnique).not.toHaveBeenCalled();
  });

  it('throws not found when updating unknown department id', async () => {
    prisma.department.findUnique.mockResolvedValue(null);

    try {
      await service.updateDepartment('dept-missing', { name: 'Finance' });
      fail('expected department not found');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'DEPARTMENT_NOT_FOUND',
      });
    }
  });

  it('normalizes blank helperText to null for problem category create', async () => {
    prisma.problemCategory.create.mockResolvedValue({
      id: 'pc-1',
      name: 'Leak',
      helperText: null,
      isActive: true,
    });

    await service.createProblemCategory({
      name: 'Leak',
      helperText: '   ',
    });

    expect(prisma.problemCategory.create).toHaveBeenCalledWith({
      data: {
        name: 'Leak',
        helperText: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        helperText: true,
        isActive: true,
      },
    });
  });

  it('maps duplicate operator displayName error to business code', async () => {
    prisma.operator.create.mockRejectedValue(createPrismaKnownError('P2002'));

    try {
      await service.createOperator({ displayName: ' Alice ' });
      fail('expected duplicate operator error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'OPERATOR_NAME_EXISTS',
      });
    }
  });
});
