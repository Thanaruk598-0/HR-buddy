import { BadRequestException } from '@nestjs/common';

const OTHER_DEPARTMENT_ID = 'dept_other';

export function assertDepartmentOtherRule(params: {
  departmentId: string;
  departmentName: string;
  departmentOther?: string | null;
}) {
  const { departmentId, departmentName, departmentOther } = params;

  const normalizedDepartmentName = departmentName.trim().toLowerCase();
  const isOtherDepartment =
    departmentId === OTHER_DEPARTMENT_ID ||
    normalizedDepartmentName === 'other' ||
    normalizedDepartmentName === 'others';

  if (isOtherDepartment && !departmentOther?.trim()) {
    throw new BadRequestException({
      code: 'DEPARTMENT_OTHER_REQUIRED',
      message: 'departmentOther is required when department is other',
      field: 'departmentOther',
    });
  }
}
