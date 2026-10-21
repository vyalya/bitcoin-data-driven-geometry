-- Generated; 47 dates. Dry-run before execution.
-- Units: fee and outputs.value are satoshis; virtual_size is BIP141 vbytes.
-- Fee aggregation happens at transaction granularity, before outputs are unnested.
WITH tx AS (
  SELECT DATE(block_timestamp) AS day, hash, block_number, fee, virtual_size, outputs
  FROM `bigquery-public-data.crypto_bitcoin.transactions`
  WHERE DATE(block_timestamp) IN UNNEST([DATE '2009-03-18', DATE '2009-06-12', DATE '2010-05-06', DATE '2010-12-17', DATE '2011-03-11', DATE '2011-08-05', DATE '2011-09-06', DATE '2012-07-26', DATE '2012-11-06', DATE '2013-03-25', DATE '2013-06-06', DATE '2014-03-18', DATE '2014-06-27', DATE '2014-08-08', DATE '2015-01-15', DATE '2015-08-24', DATE '2015-11-13', DATE '2016-03-09', DATE '2016-06-17', DATE '2016-06-24', DATE '2016-11-08', DATE '2017-05-12', DATE '2017-08-09', DATE '2018-12-19', DATE '2019-10-23', DATE '2020-01-30', DATE '2020-03-11', DATE '2020-03-15', DATE '2020-04-20', DATE '2020-11-03', DATE '2021-01-06', DATE '2021-09-20', DATE '2021-09-24', DATE '2022-06-15', DATE '2022-11-30', DATE '2023-02-06', DATE '2023-03-14', DATE '2023-05-25', DATE '2023-10-07', DATE '2024-04-13', DATE '2024-08-16', DATE '2024-11-05', DATE '2024-12-09', DATE '2025-01-27', DATE '2025-04-02', DATE '2025-06-13', DATE '2025-06-22'])
    AND NOT is_coinbase
), fees AS (
  SELECT day,
    COUNT(*) AS transactionCount,
    COUNT(DISTINCT CONCAT(CAST(block_number AS STRING), ':', hash)) AS uniqueTransactionCount,
    COUNTIF(fee IS NULL OR fee < 0 OR virtual_size IS NULL OR virtual_size <= 0) AS invalidFeeTransactions,
    SUM(fee) AS totalFeesSat,
    [COUNTIF(SAFE_DIVIDE(fee, virtual_size) BETWEEN 0 AND 10),
     COUNTIF(SAFE_DIVIDE(fee, virtual_size) > 10 AND SAFE_DIVIDE(fee, virtual_size) <= 30),
     COUNTIF(SAFE_DIVIDE(fee, virtual_size) > 30 AND SAFE_DIVIDE(fee, virtual_size) <= 80),
     COUNTIF(SAFE_DIVIDE(fee, virtual_size) > 80)] AS feeBucketCounts
  FROM tx GROUP BY day
), outputs AS (
  SELECT day,
    COUNT(*) AS totalOutputs,
    COUNTIF(o.value IS NULL OR o.value < 0) AS invalidOutputs,
    SUM(o.value) AS rawOutputValueSat,
    COUNTIF(o.value >= 100000000000) AS outputsGte1000,
    COUNTIF(o.value >= 10000000000 AND o.value < 100000000000) AS outputs100To1000,
    COUNTIF(o.value >= 1000000000 AND o.value < 10000000000) AS outputs10To100,
    COUNTIF(o.value >= 0 AND o.value < 1000000000) AS outputsLt10
  FROM tx CROSS JOIN UNNEST(tx.outputs) o GROUP BY day
)
SELECT CAST(d AS STRING) AS date,
  COALESCE(f.transactionCount, 0) AS transactionCount,
  COALESCE(f.uniqueTransactionCount, 0) AS uniqueTransactionCount,
  COALESCE(f.invalidFeeTransactions, 0) AS invalidFeeTransactions,
  COALESCE(f.totalFeesSat, 0) AS totalFeesSat,
  IFNULL(f.feeBucketCounts, [0,0,0,0]) AS feeBucketCounts,
  COALESCE(o.totalOutputs, 0) AS totalOutputs,
  COALESCE(o.invalidOutputs, 0) AS invalidOutputs,
  COALESCE(o.rawOutputValueSat, 0) AS rawOutputValueSat,
  COALESCE(o.outputsGte1000, 0) AS outputsGte1000,
  COALESCE(o.outputs100To1000, 0) AS outputs100To1000,
  COALESCE(o.outputs10To100, 0) AS outputs10To100,
  COALESCE(o.outputsLt10, 0) AS outputsLt10
FROM UNNEST([DATE '2009-03-18', DATE '2009-06-12', DATE '2010-05-06', DATE '2010-12-17', DATE '2011-03-11', DATE '2011-08-05', DATE '2011-09-06', DATE '2012-07-26', DATE '2012-11-06', DATE '2013-03-25', DATE '2013-06-06', DATE '2014-03-18', DATE '2014-06-27', DATE '2014-08-08', DATE '2015-01-15', DATE '2015-08-24', DATE '2015-11-13', DATE '2016-03-09', DATE '2016-06-17', DATE '2016-06-24', DATE '2016-11-08', DATE '2017-05-12', DATE '2017-08-09', DATE '2018-12-19', DATE '2019-10-23', DATE '2020-01-30', DATE '2020-03-11', DATE '2020-03-15', DATE '2020-04-20', DATE '2020-11-03', DATE '2021-01-06', DATE '2021-09-20', DATE '2021-09-24', DATE '2022-06-15', DATE '2022-11-30', DATE '2023-02-06', DATE '2023-03-14', DATE '2023-05-25', DATE '2023-10-07', DATE '2024-04-13', DATE '2024-08-16', DATE '2024-11-05', DATE '2024-12-09', DATE '2025-01-27', DATE '2025-04-02', DATE '2025-06-13', DATE '2025-06-22']) d
LEFT JOIN fees f ON f.day=d
LEFT JOIN outputs o ON o.day=d
ORDER BY date;
