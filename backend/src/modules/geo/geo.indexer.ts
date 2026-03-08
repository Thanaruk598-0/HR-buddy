import { GeoCompiled } from './geo.types';

export type GeoNameCode = {
  name: string;
  code: string;
};

export type GeoIndex = {
  provinces: GeoNameCode[];
  districtsByProvince: Map<string, GeoNameCode[]>;
  subdistrictsByProvinceDistrict: Map<string, GeoNameCode[]>;
  postalCodeByAddress: Map<string, string>;
};

export function normalizeGeoName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildGeoIndex(data: GeoCompiled): GeoIndex {
  const provinces: GeoNameCode[] = [];
  const districtsByProvince = new Map<string, GeoNameCode[]>();
  const subdistrictsByProvinceDistrict = new Map<string, GeoNameCode[]>();
  const postalCodeByAddress = new Map<string, string>();

  for (const province of data.provinces) {
    const provinceKey = normalizeGeoName(province.name);

    provinces.push({
      name: province.name,
      code: province.code,
    });

    const districts: GeoNameCode[] = [];

    for (const district of province.districts) {
      const districtKey = normalizeGeoName(district.name);

      districts.push({
        name: district.name,
        code: district.code,
      });

      const subdistricts = district.subdistricts.map((subdistrict) => ({
        name: subdistrict.name,
        code: subdistrict.code,
      }));

      subdistrictsByProvinceDistrict.set(
        geoAddressKey(provinceKey, districtKey),
        subdistricts,
      );

      for (const subdistrict of district.subdistricts) {
        const subdistrictKey = normalizeGeoName(subdistrict.name);

        postalCodeByAddress.set(
          geoAddressKey(provinceKey, districtKey, subdistrictKey),
          subdistrict.postalCode,
        );
      }
    }

    districtsByProvince.set(provinceKey, districts);
  }

  return {
    provinces,
    districtsByProvince,
    subdistrictsByProvinceDistrict,
    postalCodeByAddress,
  };
}

export function geoAddressKey(...parts: string[]) {
  return parts.join('|');
}
