import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign } from 'docx';
import { MonthlySummaryForm } from './types';

const TABLE_FONT = "宋体";
const TABLE_FONT_SIZE = 21;
const LEFT_COLUMN_WIDTH_DXA = 850;

export async function generateDocx(data: MonthlySummaryForm): Promise<Blob> {
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    },
    rows: [
      // 常规工作力度 表头行
      new TableRow({
        children: [
          new TableCell({
            rowSpan: 2,
            width: { size: LEFT_COLUMN_WIDTH_DXA, type: WidthType.DXA },
            children: [createTableParagraph("本月常规工作力度", AlignmentType.CENTER)],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          ...[
            "观课\n议课（节）",
            "参加校本教研\n活动（次）",
            "示范\n开课（节）",
            "上交\n议题（个）",
            "值日\n（次）",
            "主动参与校内\n其他活动（次）",
            "上交案例\n叙事等（篇）",
            "讲座\n（场）"
          ].map(text => new TableCell({
            children: text.split('\n').map(line => createTableParagraph(line, AlignmentType.CENTER)),
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }))
        ],
      }),
      // 常规工作力度 数据行
      new TableRow({
        children: [
          data.lessonObservation,
          data.schoolTeachingActivity,
          data.demoLesson,
          data.submittedTopics,
          data.dutyDays,
          data.otherActivities,
          data.submittedCases,
          data.lectures
        ].map(val => new TableCell({
          children: [createTableParagraph(val || "0", AlignmentType.CENTER)],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100 }
        })),
      }),
      // 亮点
      createLongTextRow("本月工作亮点或创新", data.highlightsOrInnovations),
      // 问题
      createLongTextRow("本月发现问题或解决问题描述", data.problemsOrSolutions),
      // 改进
      createLongTextRow("下月工作改进措施", data.nextMonthImprovements),
      // 学习内容
      createLongTextRow("学习内容", data.learningContent),
      // 教学情况
      createLongTextRow("本月本学科教学情况", data.teachingSituation),
      // 自我评价
      new TableRow({
        children: [
          new TableCell({
            width: { size: LEFT_COLUMN_WIDTH_DXA, type: WidthType.DXA },
            children: [createTableParagraph("本月对自我总体评价", AlignmentType.CENTER)],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({
            columnSpan: 8,
            children: [
              createTableParagraph(`优秀（ ${data.selfEvaluation === '优秀' ? '√' : '  '} ）   合格（ ${data.selfEvaluation === '合格' ? '√' : '  '} ）   待合格（ ${data.selfEvaluation === '待合格' ? '√' : '  '} ）`, AlignmentType.CENTER),
              createTableParagraph("在上述括号内“√”选一项即可", AlignmentType.CENTER)
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 100, right: 100 }
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1417,
              bottom: 1417,
              left: 1417,
              right: 1417,
            }
          }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "瑞安市新纪元实验学校",
                font: "宋体",
                size: 32,
                color: "000000"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "行政干部主动工作自主发展月自评表",
                font: "黑体",
                size: 36,
                color: "000000"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${data.year || '    '} 年   ${data.month || '  '} 月   ${data.day || '  '} 日        `,
                color: "000000"
              }),
              new TextRun({
                text: `部门： ${data.department || '                    '}                   `,
                color: "000000"
              }),
              new TextRun({
                text: `姓名: ${data.name || '            '}`,
                color: "000000"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 }
          }),
          table
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function createLongTextRow(label: string, content: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: LEFT_COLUMN_WIDTH_DXA, type: WidthType.DXA },
        children: [createTableParagraph(label, AlignmentType.CENTER)],
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 100, right: 100 }
      }),
      new TableCell({
        columnSpan: 8,
        children: createFormattedParagraphs(content),
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 150, bottom: 150, left: 150, right: 150 }
      }),
    ],
  });
}

function createFormattedParagraphs(content: string): Paragraph[] {
  const normalized = (content || "").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return [createIndentedParagraph("")];
  }

  const withNumberBreaks = normalized
    .replace(/([。；;!?！？])\s*(\d+\.\s*)/g, "$1\n$2")
    .replace(/\s+(\d+\.\s*)/g, "\n$1");

  const segments = withNumberBreaks
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (segments.length === 0) {
    return [createIndentedParagraph("")];
  }

  return segments.map((line) => createIndentedParagraph(line));
}

function createIndentedParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: TABLE_FONT, size: TABLE_FONT_SIZE, color: "000000" })],
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { after: 100, line: 312 }
  });
}

function createTableParagraph(text: string, alignment: typeof AlignmentType[keyof typeof AlignmentType]): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: TABLE_FONT, size: TABLE_FONT_SIZE, color: "000000" })],
    alignment
  });
}
