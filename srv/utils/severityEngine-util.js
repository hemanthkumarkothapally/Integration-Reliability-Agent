export function calculateArtifactSeverity(
  currentLoad,
  historicalCounts = []
) {

  if (!historicalCounts.length) {

    return {

      severity: 'LOW',

      score: 0,

      zScore: 0,

      mean: 0,

      stdDev: 0
    };
  }

  /*
   * ----------------------------------------
   * MEAN
   * ----------------------------------------
   */

  const mean =
    historicalCounts.reduce(
      (a, b) => a + b,
      0
    ) / historicalCounts.length;

  /*
   * ----------------------------------------
   * VARIANCE
   * ----------------------------------------
   */

  const variance =
    historicalCounts.reduce(
      (sum, value) =>
        sum +
        Math.pow(value - mean, 2),
      0
    ) / historicalCounts.length;

  /*
   * ----------------------------------------
   * STANDARD DEVIATION
   * ----------------------------------------
   */

  const stdDev =
    Math.sqrt(variance);

  /*
   * ----------------------------------------
   * Z SCORE
   * ----------------------------------------
   */

  const zScore =
    stdDev === 0
      ? 0
      : (currentLoad - mean) /
        stdDev;

  /*
   * ----------------------------------------
   * SCORE
   * ----------------------------------------
   */

  const score =
    Number(
      Math.abs(zScore)
        .toFixed(2)
    );

  /*
   * ----------------------------------------
   * SEVERITY
   * ----------------------------------------
   */

  let severity = 'LOW';

  if (zScore >= 3) {

    severity = 'CRITICAL';

  } else if (zScore >= 2) {

    severity = 'HIGH';

  } else if (zScore >= 1) {

    severity = 'MEDIUM';

  } else if (zScore < 0.5) {

    severity = 'HEALTHY';
  }

  return {

    severity,

    score,

    zScore:
      Number(zScore.toFixed(2)),

    mean:
      Number(mean.toFixed(2)),

    stdDev:
      Number(stdDev.toFixed(2))
  };
}