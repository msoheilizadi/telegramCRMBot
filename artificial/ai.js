import fetch from 'node-fetch';

const HUGGINGFACE_API_TOKEN = '';

const inputText = `
متن زیر را بخوان و تمام قرارها، وظایف یا رویدادهایی که قابل یادآوری هستند را استخراج کن:
شنبه ساعت ۵ بعد از ظهر کلاس زبان دارم.
سه‌شنبه باید به دندانپزشکی بروم. تولد دوستم پنج‌شنبه است.
`;

try {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/thenlper/smol-small',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputText,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
        },
      }),
    }
  );

  const result = await response.json();
  console.log(result);
} catch (error) {
  console.error('Error:', error.message);
}
