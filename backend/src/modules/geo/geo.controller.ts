import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('provinces')
  provinces() {
    return this.geo.getProvinces();
  }

  @Get('districts')
  districts(@Query('province') province: string) {
    const provinceName = this.requiredQuery(province, 'province');
    return this.geo.getDistricts(provinceName);
  }

  @Get('subdistricts')
  subdistricts(
    @Query('province') province: string,
    @Query('district') district: string,
  ) {
    const provinceName = this.requiredQuery(province, 'province');
    const districtName = this.requiredQuery(district, 'district');

    return this.geo.getSubdistricts(provinceName, districtName);
  }

  @Get('postal-code')
  postalCode(
    @Query('province') province: string,
    @Query('district') district: string,
    @Query('subdistrict') subdistrict: string,
  ) {
    const provinceName = this.requiredQuery(province, 'province');
    const districtName = this.requiredQuery(district, 'district');
    const subdistrictName = this.requiredQuery(subdistrict, 'subdistrict');

    return {
      postalCode: this.geo.getPostalCode(
        provinceName,
        districtName,
        subdistrictName,
      ),
    };
  }

  private requiredQuery(value: string | undefined, key: string) {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`${key} is required`);
    }

    return normalized;
  }
}
