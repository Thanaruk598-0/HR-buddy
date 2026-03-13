import { buildContentDispositionHeader } from './content-disposition.util';

describe('buildContentDispositionHeader', () => {
  it('adds filename* with UTF-8 encoding for non-ascii names', () => {
    const fileName = 'รายงานสรุป.pdf';
    const header = buildContentDispositionHeader({
      disposition: 'attachment',
      fileName,
    });

    expect(header).toContain('attachment; filename="');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent(fileName)}`);
  });

  it('sanitizes CRLF and quotes to prevent header injection', () => {
    const header = buildContentDispositionHeader({
      disposition: 'inline',
      fileName: 'my"\r\nreport.pdf',
    });

    expect(header).toBe(
      'inline; filename="myreport.pdf"; filename*=UTF-8\'\'myreport.pdf',
    );
  });
});
