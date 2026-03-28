export interface ParsedMaterial {
  filename: string;
  content: string;
}

export interface MonthlySummaryForm {
  year: string;
  month: string;
  day: string;
  department: string;
  name: string;

  // 本月常规工作 力度 (数字)
  lessonObservation: string; // 观课 议课（节）
  schoolTeachingActivity: string; // 参加校本教研活动（次）
  demoLesson: string; // 示范 开课（节）
  submittedTopics: string; // 上交 议题（个）
  dutyDays: string; // 值日（次）
  otherActivities: string; // 主动参与校内其他活动（次）
  submittedCases: string; // 上交案例叙事等（篇）
  lectures: string; // 讲座（场）

  // 文字描述部分
  highlightsOrInnovations: string; // 本月工作亮点或创新
  problemsOrSolutions: string; // 本月发现问题或解决问题描述
  nextMonthImprovements: string; // 下月工作改进措施
  learningContent: string; // 学习内容
  teachingSituation: string; // 本月本学科教学情况

  // 总体评价
  selfEvaluation: '优秀' | '合格' | '待合格' | ''; // 本月对自我总体评价
}
