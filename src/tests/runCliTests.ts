import assert from 'node:assert/strict';
import { solveNewtonRaphson } from '../algorithms/newtonRaphson';
import { compileExpression, expressionMathML, normalizeDigits } from '../utils/mathParser';
import { runAutomatedTests } from './numericalTests';

console.log('Running numerical analysis test suite...');
const summary = runAutomatedTests();

console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${summary.total} | PASSED: ${summary.passed} | FAILED: ${summary.failed}`);
console.log(`Duration: ${summary.durationMs.toFixed(2)} ms`);
console.log(`========================================\n`);

summary.results.forEach((r, idx) => {
  const statusIcon = r.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${idx + 1}. [${statusIcon}] ${r.name}`);
  console.log(`   Expected: ${r.expected}`);
  console.log(`   Actual:   ${r.actual}`);
  if (r.errorMargin !== undefined) {
    console.log(`   Error:    ${r.errorMargin.toExponential(4)}`);
  }
  if (!r.passed) {
    console.log(`   Details:  ${r.details}`);
  }
});

if (summary.failed > 0) {
  process.exit(1);
} else {
  assert.equal(normalizeDigits('−۱٫۵e−۴'), '-1.5e-4');
  assert.equal(compileExpression('x³ − x = ۲').fn?.(1.5), -0.125);
  assert.equal(compileExpression('√(x − 2) = ۱').fn?.(3), 0);
  assert.equal(compileExpression('log(x - 1)').fn?.(2), 0);
  assert.equal(compileExpression('y = x').fn, null);
  assert.match(expressionMathML('√(x² / ۲)'), /<msqrt>.*<mfrac>.*<msup>/);
  const result = solveNewtonRaphson({
    fn: (x) => {
      if (x < 0) throw new Error('Outside the domain');
      return 1;
    },
    dfn: () => 1,
    x0: 0,
    options: { tolerance: 2, maxIterations: 1, stoppingCriterion: 'absolute_error' },
  });
  assert.equal(result.status, 'nan_encountered');
  assert.equal(result.residual, null);
  console.log('\nNumerical, expression and invalid-domain checks passed.');
}
