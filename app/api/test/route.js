export async function GET() {
  try {
    // Test 1: Raw fetch with no filter - just get first 3 rows
    const rawUrl = 'https://publicreporting.cftc.gov/resource/jun7-fc8e.json?$limit=3';
    const rawRes = await fetch(rawUrl, { cache: 'no-store' });
    const rawData = await rawRes.json();

    // Test 2: Search by market name
    const nameUrl = 'https://publicreporting.cftc.gov/resource/jun7-fc8e.json?$limit=3&$where=market_and_exchange_names+like+\'%25S%26P%25\'';
    const nameRes = await fetch(nameUrl, { cache: 'no-store' });
    const nameData = await nameRes.json();

    return Response.json({
      test1_raw_fields: rawData.length ? Object.keys(rawData[0]) : 'empty',
      test1_sample: rawData.slice(0, 2),
      test2_sp500_sample: nameData.slice(0, 3),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
