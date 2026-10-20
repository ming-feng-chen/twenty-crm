// Partners (concessions AirPal works with) and Airports (clients) share the
// standard company and person objects, told apart by the company's group.

export const COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER =
  '2b6bdbb6-cedb-445b-9f4e-1ca3bc3f85ab';
export const COMPANY_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER =
  '97c92524-09ad-48a0-b9db-cf358f3d53a4';
export const PERSON_LINKEDIN_CONNECTION_NOTE_FIELD_UNIVERSAL_IDENTIFIER =
  '6a164f75-7964-4926-953b-7ee576a9ed92';

export const PARTNERS_VIEW_UNIVERSAL_IDENTIFIER =
  '435539da-adc3-433b-999a-f451e5191db1';
export const AIRPORTS_VIEW_UNIVERSAL_IDENTIFIER =
  '887e6904-d75c-4592-8250-d890a79d9f42';
export const PARTNER_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER =
  'f051467a-08ac-4025-8c8e-a63eb5321e35';
export const AIRPORT_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER =
  'a02042b4-8796-437a-a1e0-018df221ce4e';

export const PARTNERS_VIEW_FILTER_UNIVERSAL_IDENTIFIER =
  '280ba92f-e68f-402d-ae2f-096cade69b8d';
export const AIRPORTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER =
  '51a28ed9-f723-40ce-bc88-cb5f2dd093fa';
export const PARTNER_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER =
  '5ce715c1-15d0-4a4f-813b-6dd9f736e934';
export const AIRPORT_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER =
  '9fa195de-1fa9-4a0a-9520-f1e3245977e1';

export const PARTNERS_VIEW_SORT_UNIVERSAL_IDENTIFIER =
  'e2417641-41c5-404c-9639-21c89e59982d';
export const AIRPORTS_VIEW_SORT_UNIVERSAL_IDENTIFIER =
  '48f3b0e5-4419-4fca-bb26-913a42cbc184';
export const PARTNER_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER =
  '02499029-4b26-4ee5-a3cb-0cc7ed99eab0';
export const AIRPORT_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER =
  '4fc74fd3-563b-4c55-90c5-b3c99d7b380e';

export const PARTNERS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '11e8aabb-a0b9-4c99-aaab-ce62ba6b630d';
export const AIRPORTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '53b622af-713d-4925-9323-bb420e5b5139';
export const PARTNER_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '1d3d775c-b987-4bd3-b63b-25ebfcc7683a';
export const AIRPORT_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '7d4f145d-f106-402b-92c6-3820c32e7324';

export const PARTNERS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: '72296572-2491-409a-baa2-c1cdf5a38cb7',
  category: '40bad23e-bdae-4502-8ad6-8297fbc10b38',
  people: '7a35d1df-2fc4-4a7d-b25a-c37eb974b7a1',
  domainName: '7931fc80-c1d4-4b2e-9944-f0f5f1ec1a70',
  linkedinLink: '1bdbc135-9a60-4186-9818-4a932dd451ae',
} as const;

export const AIRPORTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: 'e92881e5-4350-405a-ba06-f70932bf2bfa',
  category: 'b3e8e6bd-50a0-469b-99a7-021d2e768d98',
  people: '21ee8433-bddf-41f3-9c70-3a29fd441ba7',
  domainName: '0a153476-eaec-4fac-8194-11db4713639a',
  linkedinLink: '49f64916-e34c-4bdb-b9be-b2f0e84475f9',
} as const;

export const PARTNER_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: 'e7783565-8d3d-4af8-b3a3-bad4913a145a',
  company: 'ec0358c2-62c7-4288-bef5-7132bf8171db',
  jobTitle: '3f95ebea-9bf5-489c-bfb4-674701f894f6',
  owner: '7f916c3b-fa3a-4973-bb46-60506ab7d9c3',
  stage: '3806b656-d08d-4ff7-a04b-1de9c13297d6',
  step: '14d8c495-107d-4a0b-b9ca-c0e546db7bfd',
  nextActionDate: '80ce0e7d-4872-4995-8144-fa9b54b63588',
  lastTouchOn: '6e77cd1b-82af-4f6c-92e5-31c71c57cb5f',
  linkedinLink: 'e707ba9f-d225-4e53-9a38-19986e85d98f',
  emails: '102111f8-11d4-44cb-aaf5-dc1bd21edadd',
  connectionNote: 'd949cf0b-db97-4048-86ff-0d77b3ff77e4',
} as const;

export const AIRPORT_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: '76bcb2c1-cf3e-44f9-b2ec-21fc2ab10b85',
  company: 'cb55a485-a3c5-4306-ac42-06ca46520e0b',
  jobTitle: 'd41bf8ef-fee6-4e88-90c0-d5267c60210f',
  owner: 'd29f707f-3747-47bb-b100-183ce36c38ed',
  stage: 'b958c792-2694-4d7b-8a2a-a81447156eb1',
  step: 'b38ccefb-1213-41fc-bb61-c31c898a26ec',
  nextActionDate: '26b78bb8-51ec-4bc3-9b16-87f6e091c55c',
  lastTouchOn: 'f7c3f707-989c-47ee-870a-13068ff0580d',
  linkedinLink: '1cf1a1c4-8f8b-489a-b20b-e864baacf214',
  emails: 'b373828f-1168-42cd-a0b5-0f373a56021a',
  connectionNote: '166fc89e-e540-4533-9f21-243a04cf1ccf',
} as const;
