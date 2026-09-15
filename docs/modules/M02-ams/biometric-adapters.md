# Biometric Adapter Architecture

```php
interface BiometricImportAdapterInterface {
    public function parse(string $filePath, array $config): array;
    public function validate(array $rawRecords): array;
}
```

### Implementations:
- `ZkDataFileAdapter`: Parses `.dat` fixed/spaced rows.
- `GenericCsvAdapter`: Parses standard CSV with configurable header map.
- `ExcelFileAdapter`: Reads spreadsheet rows.
