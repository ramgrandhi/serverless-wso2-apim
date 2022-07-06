import { resolveCfImportValue } from './utils';

describe('resolveCfImportValue', () => {
  let calls = 0;

  const fakeExports = [
    { Name: 'First', Value: 'A' },
    { Name: 'Second', Value: 'B' },
    { Name: 'Third', Value: 'C' },
  ];

  beforeEach(() => {
    calls = 0;
  });

  const fakeProvider = {
    request: async (service, method, params) => {
      calls++;
      if (service !== 'CloudFormation' && method !== 'listExports') {
        throw new Error('Unexpected call to the fake provider.');
      }
      // Simulation page size of 2
      // AWS will use a page size of 100
      const start = (params && params.NextToken) || 0;
      const end = start + 2;
      return {
        Exports: fakeExports.slice(start, end),
        NextToken: end < fakeExports.length ? end : null,
      };
    },
  };

  it('value found on 1st page', async () => {
    const val = await resolveCfImportValue(fakeProvider, 'First');

    expect(val).toEqual('A');
    expect(calls).toEqual(1);
  });

  it('value not found', async () => {
    const val = await resolveCfImportValue(fakeProvider, 'Unknown');

    expect(val).toBeNull();
    expect(calls).toEqual(2);
  });

  it('value found on 2nd page', async () => {
    const val = await resolveCfImportValue(fakeProvider, 'Third');

    expect(val).toEqual('C');
    expect(calls).toEqual(2);
  });
});
