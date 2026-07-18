// Shared repairs for the 90011 資訊技術 common-subject bank (900110A10).
//
// 90011 ships inside several packs (web-design-b via import-questions.mjs, and
// computer-software-application-b/c, computer-hardware-repair-c and any future
// pack via build-exam-packs.mjs). Both builders previously kept their own copy
// of these overrides, and the copies drifted: build-exam-packs.mjs never
// received the 90011 entries at all, so 14 questions per pack fell through to
// the generic crop-filename convention `<cropPrefix>-<id>.png` — a file no crop
// step produces, because 90011 is not a crop bank. The result was 42 broken
// image references on disk across three shipped packs.
//
// One bank, one set of repairs. Import from here; do not re-copy.

// 90011's figures were extracted per page rather than per question id, so the
// filenames are page-derived and contain spaces. They are matched to questions
// by hand against source/900110A10.pdf.
export const INFORMATION_COMMON_IMAGE_OVERRIDES = {
  '90011-04-001': ['90011-page-5 1.png'],
  '90011-04-002': ['90011-page-5 2.png'],
  '90011-04-003': ['90011-page-6 3.png'],
  '90011-04-004': [
    '90011-page-6 4.png',
    '90011-page-6 4-1.png',
    '90011-page-6 4-2.png',
    '90011-page-6 4-3.png',
    '90011-page-6 4-4.png',
  ],
  '90011-04-005': ['90011-page-6 5.png'],
  '90011-04-009': ['90011-page-7 9.png'],
  '90011-04-013': ['90011-page-7 13.png'],
  '90011-04-014': ['90011-page-7 14.png'],
  '90011-04-015': ['90011-page-7 15.png'],
  '90011-04-016': ['90011-page-7 16.png'],
  '90011-04-017': ['90011-page-7 17.png'],
  '90011-04-018': ['90011-page-7 18.png'],
  '90011-04-019': ['90011-page-8 19.png'],
  '90011-04-020': ['90011-page-8 20.png'],
}

// Text extraction places these two questions on the wrong page, which would
// point their fallback page scan at the wrong sheet of 900110A10.pdf.
export const INFORMATION_COMMON_SOURCE_PAGE_OVERRIDES = {
  '90011-04-004': 6,
  '90011-04-019': 8,
}

// These questions print code in the official PDF. Transcribing it beats
// shipping a screenshot: the text stays selectable, scales, and survives a
// missing crop. A question with a `codeBlock` needs no figure at all, so
// `hasFigure` goes false and its IMAGE_OVERRIDES entry above is unused.
// `90011-04-004` is the exception — its four *options* are code, while the
// prompt keeps a single figure, so only the first override image is used.
export const INFORMATION_COMMON_CODE_BLOCK_OVERRIDES = {
  '90011-04-004': {
    optionCodeBlocks: [
      'X>3? cout<<B:cout<<A;\nX=X+1',
      'if (X>3) cout<<A; else cout<<B;\nX=X+1;',
      'switch(X) {\n  case 1: cout<<A;\n  case 2: cout<<A;\n  case 3: cout<<A;\n  default: cout<<B;',
      'while (X>3) cout<<A;\ncout<<B;\nX=X+1;',
    ],
  },
  '90011-04-005': {
    codeBlock: 'int a,b,c;\ncin>>a;\ncin>>b;\nc=a;\nif(b>c)\n    c=b;\ncout<<"the output is:"<<c;',
  },
  '90011-04-009': {
    codeBlock: 'While (sum <= 1000)\n    sum = sum + 30;',
  },
  '90011-04-013': {
    codeBlock: 'int x = 3;\nint a[] = {1,2,3,4};\nint *z;\nz = a;\nz = z + x;\ncout << *z << "\\n";',
  },
  '90011-04-014': {
    codeBlock: 'int x = 3;\nint a[] = {1,2,3,4};\nint * z;\nz = &x;\ncout << *z << "\\n";',
  },
  '90011-04-015': {
    codeBlock: 'int y = !(12 < 5 || 3 <= 5 && 3 > x) ? 7 : 9;',
  },
  '90011-04-016': {
    codeBlock: "int x;\nx = (5 <= 3 && 'A' < 'F') ? 3 : 4",
  },
  '90011-04-017': {
    codeBlock: 'int a=0, b=0, c=0;\nint x=(a<b+4);',
  },
  '90011-04-018': {
    codeBlock: 'int f(int x, int y) {\n    if(x == y) return 0;\n    else return f(x-1, y) + 1;\n}',
  },
  '90011-04-019': {
    codeBlock: 'for (i=0;i<=m-1;i++){\n    for (j=0;j<=p-1;j++){\n        c[i][j]=0;\n        for (k=0;k<=n-1;k++){\n            c[i][j]=c[i][j]+a[i][k]*b[k][j];\n        }\n    }\n}',
  },
  '90011-04-020': {
    codeBlock: 'x1=2;y1=4;\nx2=6;y2=8;\na=y2-y1;\nb=x2-x1;\nc=-a*x1+b*y1;\ncout<<a<<"x+"<<-b<<"y+"<<c<<"=0";',
  },
}
