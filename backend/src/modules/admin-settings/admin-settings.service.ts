import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminSettingsListQueryDto } from './dto/admin-settings-list.query.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto';
import {
  CreateProblemCategoryDto,
  UpdateProblemCategoryDto,
} from './dto/problem-category.dto';
import {
  CreateVehicleIssueCategoryDto,
  UpdateVehicleIssueCategoryDto,
} from './dto/vehicle-issue-category.dto';
import {
  assertPatchFields,
  normalizeOptionalSearch,
  normalizeOptionalText,
  normalizeRequiredName,
} from './rules/settings-normalize.rules';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(q: AdminSettingsListQueryDto) {
    const search = normalizeOptionalSearch(q.q);

    const where: Prisma.DepartmentWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return { items };
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const name = normalizeRequiredName(dto.name);

    try {
      return await this.prisma.department.create({
        data: {
          name,
          isActive: dto.isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'DEPARTMENT_NAME_EXISTS',
        'Department name already exists',
      );
    }
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    assertPatchFields(dto, ['name', 'isActive']);

    await this.assertDepartmentExists(id);

    const data: Prisma.DepartmentUpdateInput = {
      ...(dto.name !== undefined
        ? { name: normalizeRequiredName(dto.name) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    try {
      return await this.prisma.department.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'DEPARTMENT_NAME_EXISTS',
        'Department name already exists',
      );
    }
  }

  async listProblemCategories(q: AdminSettingsListQueryDto) {
    const search = normalizeOptionalSearch(q.q);

    const where: Prisma.ProblemCategoryWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.problemCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        helperText: true,
        isActive: true,
      },
    });

    return { items };
  }

  async createProblemCategory(dto: CreateProblemCategoryDto) {
    const name = normalizeRequiredName(dto.name);

    try {
      return await this.prisma.problemCategory.create({
        data: {
          name,
          helperText: normalizeOptionalText(dto.helperText) ?? null,
          isActive: dto.isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          helperText: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'PROBLEM_CATEGORY_NAME_EXISTS',
        'Problem category name already exists',
      );
    }
  }

  async updateProblemCategory(id: string, dto: UpdateProblemCategoryDto) {
    assertPatchFields(dto, ['name', 'helperText', 'isActive']);

    await this.assertProblemCategoryExists(id);

    const data: Prisma.ProblemCategoryUpdateInput = {
      ...(dto.name !== undefined
        ? { name: normalizeRequiredName(dto.name) }
        : {}),
      ...(dto.helperText !== undefined
        ? { helperText: normalizeOptionalText(dto.helperText) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    try {
      return await this.prisma.problemCategory.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          helperText: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'PROBLEM_CATEGORY_NAME_EXISTS',
        'Problem category name already exists',
      );
    }
  }

  async listVehicleIssueCategories(q: AdminSettingsListQueryDto) {
    const search = normalizeOptionalSearch(q.q);

    const where: Prisma.VehicleIssueCategoryWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.vehicleIssueCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return { items };
  }

  async createVehicleIssueCategory(dto: CreateVehicleIssueCategoryDto) {
    const name = normalizeRequiredName(dto.name);

    try {
      return await this.prisma.vehicleIssueCategory.create({
        data: {
          name,
          isActive: dto.isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'VEHICLE_ISSUE_CATEGORY_NAME_EXISTS',
        'Vehicle issue category name already exists',
      );
    }
  }

  async updateVehicleIssueCategory(
    id: string,
    dto: UpdateVehicleIssueCategoryDto,
  ) {
    assertPatchFields(dto, ['name', 'isActive']);

    await this.assertVehicleIssueCategoryExists(id);

    const data: Prisma.VehicleIssueCategoryUpdateInput = {
      ...(dto.name !== undefined
        ? { name: normalizeRequiredName(dto.name) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    try {
      return await this.prisma.vehicleIssueCategory.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'VEHICLE_ISSUE_CATEGORY_NAME_EXISTS',
        'Vehicle issue category name already exists',
      );
    }
  }

  async listOperators(q: AdminSettingsListQueryDto) {
    const search = normalizeOptionalSearch(q.q);

    const where: Prisma.OperatorWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(search
        ? {
            displayName: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.operator.findMany({
      where,
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { items };
  }

  async createOperator(dto: CreateOperatorDto) {
    const displayName = normalizeRequiredName(dto.displayName, 'displayName');

    try {
      return await this.prisma.operator.create({
        data: {
          displayName,
          isActive: dto.isActive ?? true,
        },
        select: {
          id: true,
          displayName: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'OPERATOR_NAME_EXISTS',
        'Operator name already exists',
      );
    }
  }

  async updateOperator(id: string, dto: UpdateOperatorDto) {
    assertPatchFields(dto, ['displayName', 'isActive']);

    await this.assertOperatorExists(id);

    const data: Prisma.OperatorUpdateInput = {
      ...(dto.displayName !== undefined
        ? { displayName: normalizeRequiredName(dto.displayName, 'displayName') }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    try {
      return await this.prisma.operator.update({
        where: { id },
        data,
        select: {
          id: true,
          displayName: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwDuplicateError(
        error,
        'OPERATOR_NAME_EXISTS',
        'Operator name already exists',
      );
    }
  }

  private buildActiveFilter(isActive?: boolean): { isActive?: boolean } {
    return isActive === undefined ? {} : { isActive };
  }

  private throwDuplicateError(
    error: unknown,
    code: string,
    message: string,
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException({ code, message });
    }

    throw error;
  }

  private async assertDepartmentExists(id: string): Promise<void> {
    const row = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found',
      });
    }
  }

  private async assertProblemCategoryExists(id: string): Promise<void> {
    const row = await this.prisma.problemCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PROBLEM_CATEGORY_NOT_FOUND',
        message: 'Problem category not found',
      });
    }
  }

  private async assertVehicleIssueCategoryExists(id: string): Promise<void> {
    const row = await this.prisma.vehicleIssueCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'VEHICLE_ISSUE_CATEGORY_NOT_FOUND',
        message: 'Vehicle issue category not found',
      });
    }
  }

  private async assertOperatorExists(id: string): Promise<void> {
    const row = await this.prisma.operator.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'OPERATOR_NOT_FOUND',
        message: 'Operator not found',
      });
    }
  }
}
