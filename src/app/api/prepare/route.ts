import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { materialsText, apiKey, baseURL, modelName, extraInstructions, teacherInfo } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    if (!materialsText || !String(materialsText).trim()) {
      return NextResponse.json({ error: '请先上传可解析的材料' }, { status: 400 });
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });

    const prompt = `你是学校行政干部工作分析助手。请根据材料先生成一份“事项清单”，用于后续正式生成月自评表。

填写者身份：
- 姓名：${teacherInfo?.name || '未提供'}
- 部门：${teacherInfo?.department || '未提供'}
- 行政职务：${teacherInfo?.title || '未提供'}
- 任教学科：${teacherInfo?.subject || '未提供'}
- 教学年级：${teacherInfo?.grade || '未提供'}
- 任教班级：${teacherInfo?.classNames || '未提供'}

任务目标：
1. 优先提取与【部门（${teacherInfo?.department || '未提供'}）】和【行政职务（${teacherInfo?.title || '未提供'}）】相关的事项。
2. 若材料含有大量教学细节，只保留与行政管理职责直接相关的部分（如督导、统筹、制度落实、过程管理、协同推进、质量改进、风险防控）。
3. 如材料较少，可按学校月度常规工作进行合理补全，但必须符合该部门与职务定位。
4. 参考额外补充说明（优先级最高）：${extraInstructions || '无'}。

输出格式：
- 仅输出可编辑的纯文本事项清单，不要输出 JSON，不要输出解释性前后缀。
- 使用 1. 2. 3. 编号。
- 每条事项使用统一结构：事项标题｜部门/职务关联｜关键动作与结果｜可映射字段。
- 条数必须根据材料信息量动态决定：信息较少时 4-5 条，信息中等时 6-8 条，信息丰富时 9-12 条；禁止机械固定为 6 条。
- 前 60% 条目必须是行政管理导向，其余可补充必要的教学相关支撑事项。
- “可映射字段”只能使用以下名称之一或多个：本月工作亮点或创新、发现问题或解决问题描述、下月工作改进措施、学习内容、本月本学科教学情况、常规工作力度。

原始材料：
${materialsText}`;

    const { text } = await generateText({
      model: openai(modelName || 'gpt-4o'),
      messages: [
        {
          role: 'system',
          content: '你擅长将碎片化材料整理为部门职责导向的可编辑事项清单，强调行政职务匹配。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    return NextResponse.json({ checklist: text.trim() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '事项清单生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
