import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import {
  buildGeoIndex,
  geoAddressKey,
  normalizeGeoName,
  type GeoIndex,
} from './geo.indexer';
import { resolveGeoDatasetPath } from './geo.dataset-path';
import { GeoCompiled } from './geo.types';

@Injectable()
export class GeoService {
  private readonly data: GeoCompiled;
  private readonly index: GeoIndex;

  constructor(private readonly config: ConfigService) {
    const filePath = resolveGeoDatasetPath({
      configuredPath: this.config.get<string>('geo.datasetPath') ?? null,
      moduleDir: __dirname,
    });

    const raw = fs.readFileSync(filePath, 'utf-8');
    this.data = JSON.parse(raw) as GeoCompiled;
    this.index = buildGeoIndex(this.data);
  }

  getProvinces() {
    return [...this.index.provinces];
  }

  getDistricts(provinceName: string) {
    const provinceKey = normalizeGeoName(provinceName);
    return [...(this.index.districtsByProvince.get(provinceKey) ?? [])];
  }

  getSubdistricts(provinceName: string, districtName: string) {
    const provinceKey = normalizeGeoName(provinceName);
    const districtKey = normalizeGeoName(districtName);

    return [
      ...(this.index.subdistrictsByProvinceDistrict.get(
        geoAddressKey(provinceKey, districtKey),
      ) ?? []),
    ];
  }

  getPostalCode(
    provinceName: string,
    districtName: string,
    subdistrictName: string,
  ) {
    const provinceKey = normalizeGeoName(provinceName);
    const districtKey = normalizeGeoName(districtName);
    const subdistrictKey = normalizeGeoName(subdistrictName);

    return (
      this.index.postalCodeByAddress.get(
        geoAddressKey(provinceKey, districtKey, subdistrictKey),
      ) ?? null
    );
  }
}
