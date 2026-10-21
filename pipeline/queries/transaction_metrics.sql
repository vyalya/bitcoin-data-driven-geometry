-- Standard SQL. @dates is ARRAY<DATE>. Run a dry run before the billed query.
-- Units: fee and outputs.value are satoshis; virtual_size is BIP141 vbytes.
-- Fee aggregation happens at transaction granularity, before outputs are unnested.
WITH tx AS (
  SELECT DATE(block_timestamp) AS day, hash, block_number, fee, virtual_size, outputs
  FROM `bigquery-public-data.crypto_bitcoin.transactions`
  WHERE DATE(block_timestamp) IN UNNEST(@dates)
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
FROM UNNEST(@dates) d
LEFT JOIN fees f ON f.day=d
LEFT JOIN outputs o ON o.day=d
ORDER BY date;
