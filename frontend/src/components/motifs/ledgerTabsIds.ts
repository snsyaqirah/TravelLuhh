// Ids that tie a LedgerTabs tab to its panel (aria-controls / aria-labelledby).
export const ledgerTabId = (idBase: string, key: string) => `${idBase}-tab-${key}`;
export const ledgerPanelId = (idBase: string, key: string) => `${idBase}-panel-${key}`;
