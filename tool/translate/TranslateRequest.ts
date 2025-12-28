import axios from 'axios';

export async function translate(map: Map<string, string>, lan: string, key: string) {
  console.log(`translating ${map.size} items to ${lan}`);

  const texts = [...map.keys()];
  const shotTexts = texts.filter((str: string) => str.length < 500);
  const longTexts = texts.filter((str: string) => str.length >= 500);

  for (let i = 0; i < shotTexts.length; i += 10) {
    const end = Math.min(i + 10, shotTexts.length);
    const toTranslate = shotTexts.slice(i, end);
    const result = await request(toTranslate, lan, key);
    for (let i = 0; i < toTranslate.length; ++i) {
      map.set(toTranslate[i], result[i]);
    }
  }
  for (const text of longTexts) {
    if (text.length > 5000) {
      console.error(`invalid input, text too long: ${text}`);
    }
    const result = await request([text], lan, key);
    map.set(text, result[0]);
  }
}

async function request(texts: string[], lan: string, key: string): Promise<string[]> {
  const result = await axios.post(
    'https://api.cognitive.microsofttranslator.com/translate',
    texts.map((str: string) => {
      return {
        Text: str,
      };
    }),
    {
      headers: {'Ocp-Apim-Subscription-Key': key},
      params: {'api-version': '3.0', 'from': 'en', 'to': lan},
    }
  );
  return (result.data as any[]).map((data: any) => data.translations[0].text);
}
