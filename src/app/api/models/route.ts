import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, baseURL } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    let baseUrlStr = baseURL || 'https://api.openai.com/v1';
    // Ensure baseUrl doesn't end with /models or trailing slash
    baseUrlStr = baseUrlStr.replace(/\/models\/?$/, '').replace(/\/$/, '');
    
    const url = new URL(`${baseUrlStr}/models`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Fetch models error: ${response.status} ${errorText}`);
      throw new Error(`连接失败 (${response.status})`);
    }

    const data = await response.json();
    
    // Extract model IDs
    // Some providers return { data: [{ id: "model-name" }] } (OpenAI standard)
    // Others might return an array directly or a different nested object
    let models: string[] = [];
    
    if (data && Array.isArray(data.data)) {
      models = data.data.map((m: any) => m.id).filter(Boolean);
    } else if (Array.isArray(data)) {
      models = data.map((m: any) => m.id || m).filter(Boolean);
    } else if (data && data.models && Array.isArray(data.models)) {
      models = data.models.map((m: any) => m.id || m).filter(Boolean);
    }

    if (models.length > 0) {
      // Sort models alphabetically for better UX
      models.sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ models, success: true });
    } else {
      // Valid connection but empty/unrecognized models format
      return NextResponse.json({ 
        success: true, 
        message: '连接成功，但未能解析到模型列表，您可以继续手动输入模型名称。' 
      });
    }

  } catch (error: any) {
    console.error('Fetch models error:', error);
    return NextResponse.json({ error: error.message || '连接测试失败，请检查配置' }, { status: 500 });
  }
}

