import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const WDA_DOWNLOAD_ROOT = 'https://owinform.wdasec.gov.tw/owInform/DLowFile'

export const SOURCE_BANKS = {
  '00700-2': { subjectCode: '00700', version: 'A15', pdfFilename: '007002A15.pdf' },
  '00700-3': { subjectCode: '00700', version: 'A13', pdfFilename: '007003A13.pdf' },
  '01300': { version: 'A13', pdfFilename: '013003A13.pdf' },
  '01600': { version: 'A12', pdfFilename: '016003A12.pdf' },
  '02000': { version: 'A11', pdfFilename: '020003A11.pdf' },
  '02100': { version: 'A12', pdfFilename: '021003A12.pdf' },
  '02800': { version: 'A11', pdfFilename: '028003A11.pdf' },
  '04200': { version: 'A11', pdfFilename: '042003A11.pdf' },
  '04202': { version: 'A11', pdfFilename: '042022A11.pdf' },
  '06000': { version: 'A12', pdfFilename: '060003A12.pdf' },
  '06700': { version: 'A13', pdfFilename: '067003A13.pdf' },
  '07602': { version: 'A13', pdfFilename: '076023A13.pdf' },
  '07700': { version: 'A12', pdfFilename: '077003A12.pdf' },
  '10000': { version: 'A15', pdfFilename: '100003A15.pdf' },
  '11800': { version: 'A14', pdfFilename: '118003A14.pdf' },
  '11800-2': { subjectCode: '11800', version: 'A15', pdfFilename: '118002A15.pdf' },
  '12000': { version: 'A12', pdfFilename: '120003A12.pdf' },
  '12000-2': { subjectCode: '12000', version: 'A12', pdfFilename: '120002A12.pdf' },
  '12600': { version: 'A12', pdfFilename: '126002A12.pdf' },
  '14500': { version: 'A13', pdfFilename: '145003A13.pdf' },
  '14900': { version: 'A15', pdfFilename: '149003A15.pdf' },
  '15100': { version: 'A14', pdfFilename: '151004A14.pdf' },
  '15400': { version: 'A17', pdfFilename: '154004A17.pdf' },
  '16600': { version: 'A15', pdfFilename: '166003A15.pdf' },
  '17200': { version: 'A14', pdfFilename: '172003A14.pdf' },
  '17600': { version: 'A12', pdfFilename: '176003A12.pdf' },
  '17300': { version: 'A13', pdfFilename: '173002A13.pdf' },
  '17800': { version: 'A13', pdfFilename: '178004A13.pdf' },
  '19500': { version: 'A17', pdfFilename: '195002A17.pdf' },
  '20000': { version: 'A13', pdfFilename: '200003A13.pdf' },
  '20100': { version: 'A12', pdfFilename: '201003A12.pdf' },
  '20600': { version: 'A13', pdfFilename: '206003A13.pdf' },
  '21500': { version: 'A11', pdfFilename: '215003A11.pdf' },
  '22200': { version: 'A15', pdfFilename: '222002A15.pdf' },
  '22000': { version: 'A15', pdfFilename: '220001A15.pdf' },
  '22100': { version: 'A14', pdfFilename: '221001A14.pdf' },
  '07002': { version: 'A10', pdfFilename: '070024A10.pdf' },
  '07004': { version: 'A12', pdfFilename: '070044A12.pdf' },
  '11700': { version: 'A13', pdfFilename: '117002A13.pdf' },
  '14000': { version: 'A11', pdfFilename: '140003A11.pdf' },
  '18100': { version: 'A13', pdfFilename: '181003A13.pdf' },
  '18201': { version: 'A10', pdfFilename: '182012A10.pdf' },
  '18500': { version: 'A10', pdfFilename: '185003A10.pdf' },
  '07601': { version: 'A11', pdfFilename: '076013A11.pdf' },
  '07602-2': { subjectCode: '07602', version: 'A11', pdfFilename: '076022A11.pdf' },
  '10000-2': { subjectCode: '10000', version: 'A12', pdfFilename: '100002A12.pdf' },
  '09900': { version: 'A14', pdfFilename: '099004A14.pdf' },
  '13300': { version: 'A13', pdfFilename: '133003A13.pdf' },
  '20300-3': { subjectCode: '20300', version: 'A12', pdfFilename: '203003A12.pdf' },
  '20300-2': { subjectCode: '20300', version: 'A14', pdfFilename: '203002A14.pdf' },
  '22600': { version: 'A13', pdfFilename: '226004A13.pdf' },
  '90001': { version: 'A10', pdfFilename: '900012A10.pdf' },
  '90006': { version: 'A11', pdfFilename: '900060A11.pdf' },
  '90007': { version: 'A10', pdfFilename: '900070A10.pdf' },
  '90008': { version: 'A17', pdfFilename: '900080A17.pdf' },
  '90009': { version: 'A13', pdfFilename: '900090A13.pdf' },
  '90010': { version: 'A17', pdfFilename: '900100A17.pdf' },
  '90011': { version: 'A12', pdfFilename: '900110A12.pdf' },
  '90012': { version: 'A11', pdfFilename: '900120A11.pdf' },
}

export function formatSourceRevision(sources) {
  const filename = (source) => source.pdfFilename.replace(/\.pdf$/i, '')
  const generalCodes = new Set(['90006', '90007', '90008', '90009'])
  const specific = sources.filter((source) => !generalCodes.has(source.subjectCode))
  const general = sources.filter((source) => generalCodes.has(source.subjectCode))
  return [specific.map(filename).join(' + '), general.map(filename).join('/')].filter(Boolean).join(' + ')
}

export async function buildSourceProvenance(subjectCodes) {
  return Promise.all([...new Set(subjectCodes)].map(async (sourceKey) => {
    const source = SOURCE_BANKS[sourceKey]
    if (!source) throw new Error(`No official source registered for ${sourceKey}`)
    const subjectCode = source.subjectCode ?? sourceKey
    const localFilename = source.localFilename ?? source.pdfFilename
    const bytes = await readFile(new URL(`../source/${localFilename}`, import.meta.url))
    return {
      subjectCode,
      version: source.version,
      pdfFilename: source.pdfFilename,
      localFilename,
      officialUrl: `${WDA_DOWNLOAD_ROOT}/${source.pdfFilename}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  }))
}
