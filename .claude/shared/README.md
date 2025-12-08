# Shared RAROC Pricing Resources

This directory contains shared resources used by multiple Claude Code skills in this workspace.

## Contents

### Documentation

- **[RAROC_METHODOLOGY.md](RAROC_METHODOLOGY.md)** - Complete RAROC (Risk-Adjusted Return on Capital) pricing methodology
  - Formulas and calculations
  - Hurdle rates by risk rating
  - Expected loss calculation
  - Relationship value framework
  - Stress testing requirements
  - Fair lending compliance

- **[BANK_ASSUMPTIONS.md](BANK_ASSUMPTIONS.md)** - Bank-specific pricing assumptions
  - Funding costs
  - Deposit economics
  - Operating cost allocations
  - Fee structures
  - Target spreads by risk rating
  - LGD ranges by collateral type
  - **Customizable per bank** - different banks should modify this file

### Calculators

- **[pricing-matrix.js](pricing-matrix.js)** - Pricing input generator
  - Takes risk rating + loan amount
  - Outputs complete RAROC calculator inputs
  - Uses bank assumptions from BANK_ASSUMPTIONS.md
  - Executable: `node pricing-matrix.js --help`

- **[raroc-calculator.js](raroc-calculator.js)** - RAROC calculation engine
  - Deterministic calculations
  - Bank-approved formulas
  - Stand-alone and relationship RAROC
  - Automatic stress testing
  - Executable: `node raroc-calculator.js --help`

## Skills Using These Resources

The following skills reference these shared resources via symlinks:

1. **ci-credit-memo** - Commercial banker creates credit memos with RAROC pricing
   - Location: `.claude/skills/ci-credit-memo/`
   - Symlinks: `resources/RAROC_METHODOLOGY.md`, `resources/BANK_ASSUMPTIONS.md`, etc.

2. **credit-analyst-skill** - Credit analyst independently validates pricing and credit quality
   - Location: `.claude/skills/credit-analyst-skill/`
   - Symlinks: `resources/RAROC_METHODOLOGY.md`, `resources/BANK_ASSUMPTIONS.md`, etc.

## Architecture Pattern

This follows the Claude Code best practice for avoiding duplication across skills:

```
.claude/
├── shared/           ← Shared resources (single source of truth)
│   ├── RAROC_METHODOLOGY.md
│   ├── BANK_ASSUMPTIONS.md
│   ├── pricing-matrix.js
│   └── raroc-calculator.js
└── skills/
    ├── ci-credit-memo/
    │   └── resources/
    │       ├── BANK_ASSUMPTIONS.md → ../../shared/BANK_ASSUMPTIONS.md (symlink)
    │       ├── RAROC_METHODOLOGY.md → ../../shared/RAROC_METHODOLOGY.md (symlink)
    │       ├── pricing-matrix.js → ../../shared/pricing-matrix.js (symlink)
    │       └── raroc-calculator.js → ../../shared/raroc-calculator.js (symlink)
    └── credit-analyst-skill/
        └── resources/
            ├── BANK_ASSUMPTIONS.md → ../../shared/BANK_ASSUMPTIONS.md (symlink)
            ├── RAROC_METHODOLOGY.md → ../../shared/RAROC_METHODOLOGY.md (symlink)
            ├── pricing-matrix.js → ../../shared/pricing-matrix.js (symlink)
            └── raroc-calculator.js → ../../shared/raroc-calculator.js (symlink)
```

## Benefits

1. **Single Source of Truth** - Update once, reflected in all skills
2. **Consistency** - Both banker and analyst use identical methodologies
3. **Maintainability** - No need to sync changes across multiple files
4. **Customization** - Each bank can modify `BANK_ASSUMPTIONS.md` for their policies
5. **Version Control** - Clear tracking of changes to shared resources

## Updating Shared Resources

When updating files in this directory:

1. Changes automatically affect all skills that reference them
2. Test both skills after making changes
3. Recompile skills with `npm run compile-skills`
4. Consider backwards compatibility if deployed to multiple environments

## Bank-Specific Customization

The `BANK_ASSUMPTIONS.md` file contains bank-specific parameters that should be customized:

- Funding costs (updated monthly)
- Deposit pricing (updated quarterly)
- Target spreads by risk rating
- Fee structures
- Operating cost allocations
- Collateral LGD ranges

**To customize for your bank:**
1. Edit `.claude/shared/BANK_ASSUMPTIONS.md`
2. Update funding costs, fee structures, and spreads to match your bank's policies
3. Recompile skills: `npm run compile-skills`
4. Changes will be reflected in both credit memo and analyst skills

## Testing

After modifying shared resources:

```bash
# Test pricing matrix
cd .claude/shared
node pricing-matrix.js --risk-rating 5 --loan-amount 5000000

# Test RAROC calculator
node raroc-calculator.js --help

# Test from skill directory (via symlinks)
cd ../skills/ci-credit-memo
node resources/pricing-matrix.js --risk-rating 5 --loan-amount 5000000
```

## Development Workflow

The development source is in `skill-dev/`:

```
skill-dev/
├── ci-credit-memo/
│   └── resources/
│       ├── BANK_ASSUMPTIONS.md → ../../../.claude/shared/BANK_ASSUMPTIONS.md
│       └── ...
└── credit-analyst-skill/
    └── resources/
        ├── BANK_ASSUMPTIONS.md → ../../../.claude/shared/BANK_ASSUMPTIONS.md
        └── ...
```

When you run `npm run compile-skills`, it:
1. Copies from `skill-dev/` to `.claude/skills/`
2. Symlinks are preserved in the compilation
3. Both development and compiled skills reference `.claude/shared/`

## Future Skills

If you create additional skills that need RAROC pricing:

1. Create the new skill in `skill-dev/[skill-name]/`
2. In the skill's `resources/` directory, create symlinks:
   ```bash
   cd skill-dev/[skill-name]/resources
   ln -s ../../../.claude/shared/RAROC_METHODOLOGY.md .
   ln -s ../../../.claude/shared/BANK_ASSUMPTIONS.md .
   ln -s ../../../.claude/shared/pricing-matrix.js .
   ln -s ../../../.claude/shared/raroc-calculator.js .
   ```
3. Recompile: `npm run compile-skills`

---

**Maintained By:** Banks project
**Last Updated:** 2024-12-02
