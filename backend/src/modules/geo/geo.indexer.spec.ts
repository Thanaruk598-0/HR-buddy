import { buildGeoIndex, geoAddressKey, normalizeGeoName } from './geo.indexer';
import { GeoCompiled } from './geo.types';

describe('geo.indexer', () => {
  const sampleData: GeoCompiled = {
    provinces: [
      {
        name: 'Bangkok',
        code: '10',
        districts: [
          {
            name: 'Pathum Wan',
            code: '1007',
            subdistricts: [
              {
                name: 'Lumphini',
                code: '100701',
                postalCode: '10330',
              },
            ],
          },
        ],
      },
    ],
  };

  it('normalizes geo names by trimming/collapsing spaces/lowercase', () => {
    expect(normalizeGeoName('  Pathum   Wan  ')).toBe('pathum wan');
  });

  it('builds province, district and subdistrict indexes', () => {
    const index = buildGeoIndex(sampleData);

    expect(index.provinces).toEqual([{ name: 'Bangkok', code: '10' }]);

    const districts = index.districtsByProvince.get('bangkok');
    expect(districts).toEqual([{ name: 'Pathum Wan', code: '1007' }]);

    const subdistricts = index.subdistrictsByProvinceDistrict.get(
      geoAddressKey('bangkok', 'pathum wan'),
    );
    expect(subdistricts).toEqual([{ name: 'Lumphini', code: '100701' }]);

    const postalCode = index.postalCodeByAddress.get(
      geoAddressKey('bangkok', 'pathum wan', 'lumphini'),
    );
    expect(postalCode).toBe('10330');
  });
});
