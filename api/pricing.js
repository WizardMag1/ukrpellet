import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'pricing.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return res.status(200).json(data);
    }
  } catch (err) {
    console.error('Error reading pricing.json:', err);
  }

  return res.status(200).json({
    pricing: {
      pine_uah_per_t: 14500,
      acacia_elm_uah_per_t: 14500
    },
    delivery: {
      enabled: true,
      min_tons: 15,
      min_delivery_uah: 15000,
      driver_uah_per_km: 4.0
    }
  });
}
