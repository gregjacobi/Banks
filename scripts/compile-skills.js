#!/usr/bin/env node

/**
 * Compile Skills Script
 *
 * This script:
 * 1. Copies skills from skill-dev/ to .claude/skills/
 * 2. Creates .zip packages in skill-packages/ for distribution
 *
 * Usage:
 *   npm run compile-skills              # Compile all skills
 *   npm run compile-skills <skill-name> # Compile specific skill
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILL_DEV_DIR = path.join(__dirname, '..', 'skill-dev');
const CLAUDE_SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');
const PACKAGES_DIR = path.join(__dirname, '..', 'skill-packages');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    ensureDir(dest);
    const files = fs.readdirSync(src);

    files.forEach(file => {
      copyRecursive(
        path.join(src, file),
        path.join(dest, file)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function compileSkill(skillName) {
  const sourcePath = path.join(SKILL_DEV_DIR, skillName);
  const destPath = path.join(CLAUDE_SKILLS_DIR, skillName);
  const packagePath = path.join(PACKAGES_DIR, `${skillName}.zip`);

  // Validate source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Skill not found: ${sourcePath}`);
    return false;
  }

  // Validate SKILL.md exists
  const skillMdPath = path.join(sourcePath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    console.error(`❌ SKILL.md not found in ${skillName}`);
    return false;
  }

  console.log(`\n📦 Compiling skill: ${skillName}`);

  // Step 1: Copy to .claude/skills/
  console.log(`  → Copying to .claude/skills/${skillName}/`);
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true });
  }
  copyRecursive(sourcePath, destPath);
  console.log(`  ✓ Installed to .claude/skills/`);

  // Step 2: Create zip package
  console.log(`  → Creating package: ${skillName}.zip`);
  ensureDir(PACKAGES_DIR);

  try {
    // Remove old package if exists
    if (fs.existsSync(packagePath)) {
      fs.unlinkSync(packagePath);
    }

    // Create zip (using native zip command)
    const cwd = SKILL_DEV_DIR;
    execSync(`zip -r "${packagePath}" "${skillName}" -x "*.DS_Store" "*/__pycache__/*"`, {
      cwd,
      stdio: 'pipe'
    });

    const stats = fs.statSync(packagePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ✓ Package created: ${skillName}.zip (${sizeKB}KB)`);
  } catch (error) {
    console.error(`  ❌ Failed to create package: ${error.message}`);
    return false;
  }

  console.log(`✅ Successfully compiled: ${skillName}\n`);
  return true;
}

function main() {
  const args = process.argv.slice(2);

  console.log('🔧 Claude Code Skill Compiler\n');
  console.log('═══════════════════════════════════════\n');

  // Ensure directories exist
  ensureDir(CLAUDE_SKILLS_DIR);
  ensureDir(PACKAGES_DIR);

  // Check if skill-dev exists
  if (!fs.existsSync(SKILL_DEV_DIR)) {
    console.error('❌ skill-dev/ directory not found!');
    console.log('Create it with: mkdir skill-dev');
    process.exit(1);
  }

  let skills = [];

  if (args.length > 0) {
    // Compile specific skill
    skills = args;
  } else {
    // Compile all skills
    const entries = fs.readdirSync(SKILL_DEV_DIR, { withFileTypes: true });
    skills = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    if (skills.length === 0) {
      console.log('ℹ️  No skills found in skill-dev/');
      console.log('\nTo create a skill, add a directory with SKILL.md:');
      console.log('  skill-dev/my-skill/SKILL.md');
      process.exit(0);
    }
  }

  console.log(`Found ${skills.length} skill(s) to compile:\n`);

  let successCount = 0;
  let failCount = 0;

  skills.forEach(skill => {
    if (compileSkill(skill)) {
      successCount++;
    } else {
      failCount++;
    }
  });

  console.log('═══════════════════════════════════════\n');
  console.log(`📊 Summary: ${successCount} compiled, ${failCount} failed\n`);

  if (successCount > 0) {
    console.log('📍 Locations:');
    console.log(`   Installed: .claude/skills/`);
    console.log(`   Packages:  skill-packages/\n`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main();
