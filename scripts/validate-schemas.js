#!/usr/bin/env node
/**
 * データ構造定義ファイルのバリデーション
 * 新しい書類を追加した際に、必須フィールドが揃っているか検証する
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUIRED_FIELDS = ['id', 'name', 'nameEn', 'issuer', 'standard', 'security', 'applications', 'apduCommands', 'verification', 'metadata'];
const REQUIRED_APP_FIELDS = ['name', 'description', 'dfStructure'];

let errors = 0;
let warnings = 0;

const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf-8'));

index.documents.forEach(doc => {
  const filePath = path.join(DATA_DIR, doc.file);
  console.log(`\nValidating: ${doc.file}`);

  if (!fs.existsSync(filePath)) {
    console.error(`  ERROR: File not found: ${doc.file}`);
    errors++;
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`  ERROR: Invalid JSON: ${e.message}`);
    errors++;
    return;
  }

  // Check required fields
  REQUIRED_FIELDS.forEach(field => {
    if (!data[field]) {
      if (data.status === 'planned' && ['apduCommands'].includes(field)) {
        console.warn(`  WARN: Missing optional field for planned doc: ${field}`);
        warnings++;
      } else {
        console.error(`  ERROR: Missing required field: ${field}`);
        errors++;
      }
    }
  });

  // Validate applications
  if (data.applications) {
    data.applications.forEach((app, i) => {
      REQUIRED_APP_FIELDS.forEach(field => {
        if (!app[field]) {
          console.warn(`  WARN: Application[${i}] missing field: ${field}`);
          warnings++;
        }
      });
    });
  }

  // Check ID consistency
  if (data.id !== doc.id) {
    console.error(`  ERROR: ID mismatch: index="${doc.id}" file="${data.id}"`);
    errors++;
  }

  console.log(`  OK (${data.applications?.length || 0} applications)`);
});

console.log(`\n--- Results ---`);
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);
process.exit(errors > 0 ? 1 : 0);
