const base = process.env.TEST_BASE_URL || 'http://localhost:8000';

const tinyImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL  ${name}: ${message}`);
    return false;
  }
}

async function main() {
  let passed = 0;

  if (
    await run('health endpoint', async () => {
      const response = await fetch(`${base}/api/health`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      if (!data.ok) throw new Error('health not ok');
    })
  ) {
    passed += 1;
  }

  if (
    await run('forms search pipeline', async () => {
      const response = await fetch(`${base}/api/elderly/forms/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'zh',
          profile: { name: 'Tan Oli', age: '68', householdIncome: '2500', maritalStatus: 'widowed', children: '0' },
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error('results missing');
    })
  ) {
    passed += 1;
  }

  if (
    await run('id document pdf pipeline', async () => {
      const formData = new FormData();
      formData.append('username', 'TanOli');
      formData.append('front', new Blob([tinyImage], { type: 'image/png' }), 'front.png');
      formData.append('back', new Blob([tinyImage], { type: 'image/png' }), 'back.png');
      const response = await fetch(`${base}/api/pdf/id-document`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `status ${response.status}`);
      if (!String(data.fileName).startsWith('ID-')) throw new Error('unexpected filename');
    })
  ) {
    passed += 1;
  }

  console.log(`\n${passed}/3 pipeline tests passed`);
  if (passed < 3) process.exit(1);
}

main();
