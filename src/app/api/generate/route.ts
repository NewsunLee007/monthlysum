import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

type ChecklistItem = {
  index: number;
  raw: string;
  title: string;
};

const schema = z.object({
  year: z.string().describe('填表年份，通常根据内容推断或留空'),
  month: z.string().describe('填表月份'),
  day: z.string().describe('填表日，可留空'),
  department: z.string().describe('部门或年级组'),
  name: z.string().describe('姓名'),
  
  lessonObservation: z.string().describe('观课 议课（节），数字或说明'),
  schoolTeachingActivity: z.string().describe('参加校本教研活动（次），数字或说明'),
  demoLesson: z.string().describe('示范 开课（节），数字或说明'),
  submittedTopics: z.string().describe('上交 议题（个），数字或说明'),
  dutyDays: z.string().describe('值日（次），数字或说明'),
  otherActivities: z.string().describe('主动参与校内其他活动（次），数字或说明'),
  submittedCases: z.string().describe('上交案例叙事等（篇），数字或说明'),
  lectures: z.string().describe('讲座（场），数字或说明'),

  highlightsOrInnovations: z.string().describe('本月工作亮点或创新，总结并条理化输出'),
  problemsOrSolutions: z.string().describe('本月发现问题或解决问题描述，总结并条理化输出'),
  nextMonthImprovements: z.string().describe('下月工作改进措施，总结并条理化输出'),
  learningContent: z.string().describe('学习内容，总结并条理化输出'),
  teachingSituation: z.string().describe('本月本学科教学情况，总结并条理化输出'),

  selfEvaluation: z.enum(['优秀', '合格', '待合格', '']).describe('本月对自我总体评价，基于工作情况推断，默认为“优秀”或“合格”')
});

const NARRATIVE_FIELDS = [
  'highlightsOrInnovations',
  'problemsOrSolutions',
  'nextMonthImprovements',
  'learningContent',
  'teachingSituation',
] as const;

const NON_TEACHING_FIELDS = [
  'highlightsOrInnovations',
  'problemsOrSolutions',
  'nextMonthImprovements',
  'learningContent',
] as const;

const TEACHING_BOUNDARY_REGEX =
  /(班级|[一二三四五六七八九十]\d{2,3}班|\d{3,4}班|任课|周测|月考|阅读理解|完形填空|听力|课堂|作业|学情|得分率|及格率|优秀率|教学质量|试卷|讲评|错题)/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseChecklistItems(curatedChecklist: string): ChecklistItem[] {
  return curatedChecklist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const noNumber = line.replace(/^\d+[\.\)、]\s*/, '').trim();
      const title = noNumber.split(/[｜|]/)[0]?.trim() || noNumber;
      return {
        index: idx + 1,
        raw: noNumber || line,
        title,
      };
    })
    .filter((item) => item.title.length > 0);
}

function buildChecklistBlock(items: ChecklistItem[]): string {
  return items
    .map((item) => `${item.index}. ${item.title}｜${item.raw}`)
    .join('\n');
}

function normalizeModelText(text: string): string {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```')) {
    const lines = cleanedText.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1].startsWith('```')) lines.pop();
    cleanedText = lines.join('\n').trim();
  }
  return cleanedText;
}

function findMissingChecklistTitles(data: Record<string, unknown>, items: ChecklistItem[]): string[] {
  const combined = NARRATIVE_FIELDS
    .map((field) => String(data[field] || ''))
    .join('\n');

  return items
    .map((item) => item.title)
    .filter((title) => title && !combined.includes(title));
}

function hasTeachingBoundaryViolation(data: Record<string, unknown>): boolean {
  return NON_TEACHING_FIELDS.some((field) => {
    const content = String(data[field] || '');
    return TEACHING_BOUNDARY_REGEX.test(content);
  });
}

async function ensureChecklistCoverage(
  openai: ReturnType<typeof createOpenAI>,
  modelName: string | undefined,
  result: Record<string, unknown>,
  checklistItems: ChecklistItem[]
): Promise<Record<string, unknown>> {
  const missingTitles = findMissingChecklistTitles(result, checklistItems);
  if (missingTitles.length === 0) {
    return result;
  }

  const revisePrompt = `请对下面这份月自评 JSON 做最小必要补充，确保遗漏事项全部被使用，并且各字段语气与原文一致。

遗漏的事项标题（必须逐条覆盖且标题原样出现）：
${missingTitles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}

约束：
1. 仅在五个文字字段中补充或微调：highlightsOrInnovations、problemsOrSolutions、nextMonthImprovements、learningContent、teachingSituation。
2. 不得删除已有关键信息，不得改动数字字段含义。
3. 避免生硬堆砌，每条遗漏事项只需合理出现一次并融入上下文。
4. 只返回完整 JSON，不要解释。

当前 JSON：
${JSON.stringify(result, null, 2)}`;

  const { text } = await generateText({
    model: openai(modelName || 'gpt-4o'),
    messages: [
      {
        role: 'system',
        content: '你擅长在不破坏原文结构的前提下做精准补全，确保事项完整覆盖。',
      },
      {
        role: 'user',
        content: revisePrompt,
      }
    ],
    temperature: 0.2,
  });

  const revisedText = normalizeModelText(text);
  return JSON.parse(revisedText);
}

async function enforceTeachingFieldBoundary(
  openai: ReturnType<typeof createOpenAI>,
  modelName: string | undefined,
  result: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!hasTeachingBoundaryViolation(result)) {
    return result;
  }

  const revisePrompt = `请对下面这份月自评 JSON 做字段边界纠偏，重点处理“班级层面的教学内容错放”问题。

硬性规则：
1. 涉及班级、任课班、周测/月考、学情、得分率、阅读理解等“班级教学层面”的内容，只能放在 teachingSituation 字段。
2. highlightsOrInnovations、problemsOrSolutions、nextMonthImprovements、learningContent 四个字段中，不得出现上述班级教学细节。
3. 若这四个字段有此类内容，请迁移到 teachingSituation，并在原字段改写为部门管理/行政统筹视角表述。
4. 不改动数字字段语义，不删除关键信息，保持整体语气一致。
5. 只返回完整 JSON，不要解释。

当前 JSON：
${JSON.stringify(result, null, 2)}`;

  const { text } = await generateText({
    model: openai(modelName || 'gpt-4o'),
    messages: [
      {
        role: 'system',
        content: '你擅长做字段边界纠偏，保证教学内容与行政内容归位准确。',
      },
      {
        role: 'user',
        content: revisePrompt,
      }
    ],
    temperature: 0.2,
  });

  const revisedText = normalizeModelText(text);
  return JSON.parse(revisedText);
}

function sanitizeNarrativeText(value: unknown, title: string): string {
  let text = String(value || '');
  if (title.trim()) {
    const safeTitle = escapeRegExp(title.trim());
    const wrappedTitlePattern = new RegExp(`[｜|]\\s*${safeTitle}\\s*[｜|]`, 'g');
    const plainTitlePattern = new RegExp(safeTitle, 'g');
    text = text.replace(wrappedTitlePattern, '').replace(plainTitlePattern, '本人');
  }

  text = text
    .replace(/[‘’']/g, '"')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/本人本人/g, '本人')
    .trim();

  return text;
}

function postProcessOutput(
  result: Record<string, unknown>,
  teacherTitle: string
): Record<string, unknown> {
  const normalized = { ...result };
  NARRATIVE_FIELDS.forEach((field) => {
    normalized[field] = sanitizeNarrativeText(normalized[field], teacherTitle);
  });
  return normalized;
}

export async function POST(req: Request) {
  try {
    const { materialsText, curatedChecklist, apiKey, baseURL, modelName, extraInstructions, teacherInfo, generationLength } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }
    if (!curatedChecklist || !String(curatedChecklist).trim()) {
      return NextResponse.json({ error: '请先生成并确认事项清单' }, { status: 400 });
    }
    const checklistItems = parseChecklistItems(String(curatedChecklist));
    if (checklistItems.length === 0) {
      return NextResponse.json({ error: '事项清单内容为空或格式无效，请重新整理后再生成' }, { status: 400 });
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });

    let lengthInstruction = "内容详实，符合常规汇报";
    if (generationLength === "简略") {
      lengthInstruction = "语言极其精炼，高度概括，采用大纲或短句形式，要点清晰，适合快速阅读。不要长篇大论。";
    } else if (generationLength === "详细") {
      lengthInstruction = "内容深度展开，丰富详实，多从教育理念、学生反馈和具体实施细节进行补充和扩展，适合作为重点汇报材料。";
    }

    const prompt = `你是一个资深、专业的学校行政管理专家。你需要根据用户提供的【原始材料】，为其撰写一份高质量的《行政干部主动工作自主发展月自评表》。
    
填写者核心身份画像（请务必深刻理解并代入该角色）：
- 姓名：${teacherInfo?.name || '未提供'}
- 部门：${teacherInfo?.department || '未提供'}
- 行政职务：${teacherInfo?.title || '未提供'}
- 任教学科：${teacherInfo?.subject || '未提供'}
- 教学年级：${teacherInfo?.grade || '未提供'}
- 任教班级：${teacherInfo?.classNames || '未提供'}

【撰写核心原则与逻辑推断】：
1. 行政职务优先原则：在“工作亮点”“发现问题”“改进措施”“学习内容”中，必须优先呈现与【行政职务（${teacherInfo?.title}）】和【部门（${teacherInfo?.department}）】相关的管理职责、统筹职责、组织职责，教学内容只可作为次要支撑。
2. 字段角色边界：除“本月本学科教学情况”外，其他文字字段不得以课堂教学为主线，不得把“备课、上课、作业批改、考试分析”等作为主体叙事。
3. 清单优先原则：先以“事项清单”作为主输入进行归纳和展开，再回看原始材料做补充与校准；不得偏离清单主线。
4. 深度关联与合理拓展：不要机械找关键词。你需要基于材料事件，结合职务职责做专业化提炼；如“开会”“检查”需升级为“组织部门协同推进”“落实制度执行与过程督导”“形成闭环改进”。
5. 杜绝“未提及”：原始材料较少时，绝对不要写“材料中未提及”。必须结合【部门】【职务】【学校月度常规】进行合理推断补全，保证内容专业、完整、可信。

【字段填写特殊规则】：
1. 语气与排版：以第一人称“我”撰写，必须使用 1. 2. 3. 分点论述，语言体现行政干部的组织力、执行力与改进意识。
2. 长度控制：${lengthInstruction}。
3. 角色锚点强约束：highlightsOrInnovations、problemsOrSolutions、nextMonthImprovements、learningContent 四个字段中，每个字段第1点必须明确出现【部门（${teacherInfo?.department || '所在部门'}）】或【职务（${teacherInfo?.title || '行政职务'}）】职责表达。
4. 管理导向强约束：上述四个字段至少 70% 内容应为行政管理工作（制度落实、协同统筹、流程优化、督导反馈、风险防控、质量改进等），教学内容最多点到为止。
5. 表达去僵化：避免反复使用“${teacherInfo?.department || '部门'}${teacherInfo?.title || ''}……”“作为${teacherInfo?.title || '行政干部'}……”等固定句式；每个字段中此类称谓最多出现1次，其余使用“本月我围绕…/在推进…过程中/针对…我采取了…”等行动表达。
6. 语言风格贴合素材：用词、句式、语气应与“事项清单+原始材料”保持一致，优先复用材料中的关键表达与业务术语；避免空泛拔高、口号化修饰和明显“AI腔”。
7. 贴合但不照抄：可在不改变事实的前提下润色，但不要机械复制整句；确保表达自然、连贯、可信。
8. 字段边界硬约束：班级层面的教学细节（如班级编号、周测月考、学情、得分率、阅读理解等）只能写在 teachingSituation；不得写入 highlightsOrInnovations、problemsOrSolutions、nextMonthImprovements、learningContent。
9. “本月常规工作力度”数字：优先提取材料；无明确数字时按职务性质给出合理估算，不得全部为0。
10. “本月本学科教学情况”是唯一可重点展开教学的一栏，需围绕【学科：${teacherInfo?.subject}】【年级：${teacherInfo?.grade}】【任教班级：${teacherInfo?.classNames || '未提供'}】总结；如“无教学班”，则写明全职行政管理并补充学科建设指导。
11. “本月对自我总体评价”：根据材料推断为“优秀”“合格”或“待合格”。
12. 清单全量使用约束：以下“事项标题清单”中的每一条，必须至少在五个文字字段之一中原样出现一次，不得遗漏。
13. 参考用户额外补充说明：${extraInstructions || '无'}。该说明优先级最高，必须实质性融入。
14. 正文去职务标签：五个文字字段中不得出现“｜职务名称｜”样式文本，不得出现“｜${teacherInfo?.title || '行政职务'}｜”。
15. 正文去职务称谓：五个文字字段中避免直接出现“${teacherInfo?.title || '行政职务'}”称谓，改用“我”“本人”“本月我”。
16. 引号规范：正文中如需引号，统一使用双引号，不要使用单引号。

【事项清单（已人工可编辑确认，优先依据该内容生成）】：
${curatedChecklist}

【事项标题清单（必须逐条覆盖，标题原样出现）】：
${buildChecklistBlock(checklistItems)}

【原始材料内容（用于补充和校准）】：
${materialsText}

【输出格式要求】：
必须且只能返回合法的 JSON 格式，不要输出 markdown 代码块 (\`\`\`json) 或任何多余的说明文字。

JSON 的键必须严格包含以下字段：
- year (字符串，如 "2024")
- month (字符串，如 "3")
- day (字符串)
- department (字符串)
- name (字符串)
- lessonObservation (字符串，观课议课节数)
- schoolTeachingActivity (字符串，参加校本教研次数)
- demoLesson (字符串，示范开课节数)
- submittedTopics (字符串，上交议题数)
- dutyDays (字符串，值日次数)
- otherActivities (字符串，主动参与活动次数)
- submittedCases (字符串，上交案例篇数)
- lectures (字符串，讲座场数)
- highlightsOrInnovations (字符串，本月工作亮点)
- problemsOrSolutions (字符串，发现问题或解决描述)
- nextMonthImprovements (字符串，下月改进措施)
- learningContent (字符串，学习内容)
- teachingSituation (字符串，本月教学情况)
- selfEvaluation (字符串，必须是 "优秀" 或 "合格" 或 "待合格")
`;

    // Many third-party OpenAI-compatible APIs struggle with `generateObject` strict mode / tool calling.
    // So we use standard text generation and ask it to output JSON.
    const { text } = await generateText({
      model: openai(modelName || 'gpt-4o'),
      messages: [
        {
          role: 'system',
          content: '你是一个资深的学校行政管理专家。你需要具备强大的逻辑推理和信息重组能力，能够根据只言片语的材料，结合用户的【行政职务】，写出高度专业、格局宏大的月度自评总结。',
        },
        {
          role: 'user',
          content: prompt,
        }
      ],
      temperature: 0.6, // Increased temperature to allow more creative and professional administrative reasoning
    });
    
    const cleanedText = normalizeModelText(text);
    const parsedObject = JSON.parse(cleanedText);
    const coverageChecked = await ensureChecklistCoverage(openai, modelName, parsedObject, checklistItems);
    const boundaryChecked = await enforceTeachingFieldBoundary(openai, modelName, coverageChecked);
    const object = postProcessOutput(boundaryChecked, String(teacherInfo?.title || ''));

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('Generation error:', error);
    
    // Better error formatting to help user debug
    let errorMessage = error.message || 'Generation failed';
    if (errorMessage.includes('could not parse the response')) {
      errorMessage = '模型返回的数据格式不符合要求，解析 JSON 失败。建议尝试使用更强大的模型 (如 gpt-4o 或 claude-3-5-sonnet)。';
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
