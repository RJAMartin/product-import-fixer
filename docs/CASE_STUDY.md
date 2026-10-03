# Stockroom — supplier data to a Shopify catalog

## Problem

A supplier's spreadsheet rarely uses the same structure as an e-commerce platform. Even a small catalog can contain ambiguous prices, inconsistent product identifiers and variants spread over multiple rows. Import errors force merchants to edit and retry without a clear view of the underlying problem.

## Delivered product

Stockroom provides a four-step workflow: import, map, review and export. A merchant maps source columns once, inspects the resulting products, fixes actionable issues beside the relevant row, and downloads a CSV for Shopify's own import preview.

This is a portfolio project using synthetic example data, not commissioned client work. No customer adoption or time-savings metrics are claimed.

## Engineering decisions

- **An explicit data model:** CSV strings remain strings. SKU leading zeros are not lost through numeric inference.
- **Separate mapping and review:** the source remains available in memory. Applying a new mapping deliberately rebuilds the review; the interface explains that it replaces review edits.
- **Variant-aware validation:** uniqueness is checked within each product's option combinations, not by treating every row as an independent product. Shared product fields must agree.
- **Conservative price cleanup:** users choose the decimal convention. Ambiguous values remain visible for review instead of being guessed or silently converted to zero.
- **Inspectable output:** exports use a documented subset of Shopify's schema. No direct store writes, credentials or hidden API calls are involved.
- **Draft-first export:** new products remain unpublished until a merchant reviews them in Shopify. Inventory imports require an explicit single-location choice.
- **Privacy:** processing is local; image URLs are not fetched. Only explicitly saved mapping metadata is persisted.
- **Desktop and mobile:** the review table scrolls within its panel, and row editing moves above the table on narrower screens.

## Testing

The automated tests verify the transformations and the resulting CSV structure. Browser checks follow the user journey through a real downloaded file, confirm data preservation, and inspect responsive layouts. Export is checked against Shopify's public format but has not been imported into a connected merchant store.

## Tradeoffs

The first release intentionally supports new-product file preparation. Store-aware validation, multi-location inventory, XLSX, taxonomy/metafield validation and extra image rows would need their own designs and tests. A generic "valid" flag would overstate what a disconnected tool can know, so the interface distinguishes blocking checks, advisory warnings and Shopify's final import preview.

## Freelance relevance

The project demonstrates an e-commerce operations workflow: heterogeneous input, mapping, validation, repair, and reliable output. The same architecture can support supplier onboarding, catalog migrations, CRM imports and other business-data preparation tools.
