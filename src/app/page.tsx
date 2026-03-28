"use client";

import { useState, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { parseFile } from "@/lib/file-parser";
import { generateDocx } from "@/lib/docx-generator";
import { MonthlySummaryForm, ParsedMaterial } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { FileUp, Cpu, Loader2, FileText, CheckCircle2, Download, RefreshCcw, Settings2, Sparkles, AlertCircle, Wifi, WifiOff, Settings } from "lucide-react";

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI (国际版)", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  { id: "anthropic", name: "Anthropic (Claude)", defaultBaseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-5-sonnet-20240620" },
  { id: "deepseek", name: "DeepSeek (深度求索)", defaultBaseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { id: "moonshot", name: "Moonshot AI (Kimi)", defaultBaseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
  { id: "aliyun", name: "Alibaba Qwen (通义千问)", defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  { id: "zhipu", name: "Zhipu GLM (智谱清言)", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4" },
  { id: "custom", name: "自定义接口 (Custom)", defaultBaseUrl: "", defaultModel: "" }
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [providerId, setProviderId] = useState<string>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState<string>(AI_PROVIDERS[0].defaultBaseUrl);
  const [modelName, setModelName] = useState<string>(AI_PROVIDERS[0].defaultModel);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Basic info state
  const [teacherName, setTeacherName] = useState("");
  const [teacherDepartment, setTeacherDepartment] = useState("");
  const [teacherTitle, setTeacherTitle] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherGrade, setTeacherGrade] = useState("");
  const [teacherClasses, setTeacherClasses] = useState("");
  const [generationLength, setGenerationLength] = useState("适中");
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    
    const savedApiKey = localStorage.getItem("apiKey");
    const savedProviderId = localStorage.getItem("providerId");
    const savedBaseURL = localStorage.getItem("baseURL");
    const savedModelName = localStorage.getItem("modelName");
    
    const savedTeacherName = localStorage.getItem("teacherName");
    const savedTeacherDepartment = localStorage.getItem("teacherDepartment");
    const savedTeacherTitle = localStorage.getItem("teacherTitle");
    const savedTeacherSubject = localStorage.getItem("teacherSubject");
    const savedTeacherGrade = localStorage.getItem("teacherGrade");
    const savedTeacherClasses = localStorage.getItem("teacherClasses");

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedProviderId) setProviderId(savedProviderId);
    if (savedBaseURL) setBaseURL(savedBaseURL);
    if (savedModelName) setModelName(savedModelName);
    
    if (savedTeacherName) setTeacherName(savedTeacherName);
    if (savedTeacherDepartment) setTeacherDepartment(savedTeacherDepartment);
    if (savedTeacherTitle) setTeacherTitle(savedTeacherTitle);
    if (savedTeacherSubject) setTeacherSubject(savedTeacherSubject);
    if (savedTeacherGrade) setTeacherGrade(savedTeacherGrade);
    if (savedTeacherClasses) setTeacherClasses(savedTeacherClasses);
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem("apiKey", apiKey);
    localStorage.setItem("providerId", providerId);
    localStorage.setItem("baseURL", baseURL);
    localStorage.setItem("modelName", modelName);
    setIsSettingsOpen(false);
  };

  // Save basic info to localStorage when they change
  useEffect(() => {
    localStorage.setItem("teacherName", teacherName);
    localStorage.setItem("teacherDepartment", teacherDepartment);
    localStorage.setItem("teacherTitle", teacherTitle);
    localStorage.setItem("teacherSubject", teacherSubject);
    localStorage.setItem("teacherGrade", teacherGrade);
    localStorage.setItem("teacherClasses", teacherClasses);
  }, [teacherName, teacherDepartment, teacherTitle, teacherSubject, teacherGrade, teacherClasses]);
  
  const [materials, setMaterials] = useState<ParsedMaterial[]>([]);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [curatedChecklist, setCuratedChecklist] = useState("");
  
  const [isParsing, setIsParsing] = useState(false);
  const [isPreparingChecklist, setIsPreparingChecklist] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<MonthlySummaryForm | null>(null);
  const checklistItems = useMemo(() => {
    return curatedChecklist
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const cleaned = line.replace(/^\d+[\.\)、]\s*/, "").trim();
        const parts = cleaned.split(/[｜|]/).map((part) => part.trim()).filter(Boolean);
        return {
          index: idx + 1,
          title: parts[0] || `事项 ${idx + 1}`,
          role: parts[1] || "",
          action: parts[2] || "",
          mapping: parts[3] || "",
          full: cleaned
        };
      });
  }, [curatedChecklist]);

  const onDrop = async (acceptedFiles: File[]) => {
    setIsParsing(true);
    setError(null);
    try {
      const parsed = await Promise.all(
        acceptedFiles.map(async (file) => {
          const content = await parseFile(file);
          return { filename: file.name, content };
        })
      );
      setMaterials([...materials, ...parsed]);
    } catch (err: any) {
      setError(`文件解析失败: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.md'],
      'text/markdown': ['.md']
    }
  });

  const handleFetchModels = async () => {
    if (!apiKey) {
      setError("请先输入 API 密钥以获取模型列表");
      return;
    }
    
    setIsFetchingModels(true);
    setConnectionStatus('idle');
    setConnectionMessage(null);
    setError(null);
    
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          baseURL
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取模型列表失败');
      }

      setConnectionStatus('success');

      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        setConnectionMessage(`成功获取 ${data.models.length} 个模型`);
        // 如果当前模型不在列表中，且列表不为空，自动选择第一个
        if (!data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
      } else if (data.message) {
        // Connected but no models array
        setAvailableModels([]);
        setConnectionMessage(data.message);
      } else {
        throw new Error('未获取到可用的模型');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message);
      // Keep previous models if we had them, or clear them? Better to let user manually type if error
      if (availableModels.length === 0) {
        setConnectionMessage(err.message + "，请检查配置或直接手动输入模型名称");
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleGenerate = async () => {
    if (!teacherName || !teacherDepartment || !teacherTitle || !teacherSubject || !teacherGrade) {
      setError("请填写基础信息（姓名、部门、职务、学科、年级）");
      return;
    }
    if (!apiKey) {
      setError("请在设置中配置 API Key");
      setIsSettingsOpen(true);
      return;
    }
    if (materials.length === 0) {
      setError("请至少上传一份工作材料或填写补充说明");
      return;
    }
    if (!curatedChecklist.trim()) {
      setError("请先生成并确认事项清单，再正式生成自评表");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const materialsText = materials.map(m => `【${m.filename}】\n${m.content}`).join('\n\n');
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialsText,
          curatedChecklist,
          apiKey,
          baseURL,
          modelName,
          extraInstructions,
          teacherInfo: {
            name: teacherName,
            department: teacherDepartment,
            title: teacherTitle,
            subject: teacherSubject,
            grade: teacherGrade,
            classNames: teacherClasses
          },
          generationLength
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();
      setFormData(data);
      setStep(3);
      
      // Scroll to bottom after short delay to show results
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
      
    } catch (err: any) {
      setError(`生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrepareChecklist = async () => {
    if (!teacherName || !teacherDepartment || !teacherTitle || !teacherSubject || !teacherGrade) {
      setError("请先完整填写基础信息（姓名、部门、职务、学科、年级）");
      return;
    }
    if (!apiKey) {
      setError("请在设置中配置 API Key");
      setIsSettingsOpen(true);
      return;
    }
    if (materials.length === 0) {
      setError("请先上传材料，再生成事项清单");
      return;
    }

    setIsPreparingChecklist(true);
    setError(null);

    try {
      const materialsText = materials.map(m => `【${m.filename}】\n${m.content}`).join('\n\n');

      const response = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialsText,
          apiKey,
          baseURL,
          modelName,
          extraInstructions,
          teacherInfo: {
            name: teacherName,
            department: teacherDepartment,
            title: teacherTitle,
            subject: teacherSubject,
            grade: teacherGrade,
            classNames: teacherClasses
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '事项清单生成失败');
      }

      const data = await response.json();
      setCuratedChecklist(data.checklist || "");
      setStep(2);
    } catch (err: any) {
      setError(`事项清单生成失败: ${err.message}`);
    } finally {
      setIsPreparingChecklist(false);
    }
  };

  const handleDownload = async () => {
    if (!formData) return;
    try {
      const blob = await generateDocx(formData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `月自评表_${formData.name || '未知'}_${formData.month || '当'}月.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`下载失败: ${err.message}`);
    }
  };

  const updateFormData = (key: keyof MonthlySummaryForm, value: string) => {
    if (formData) {
      setFormData({ ...formData, [key]: value });
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-slate-900 pb-24 selection:bg-blue-200 selection:text-blue-900">
      {/* Refined Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 transition-all">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[17px] font-bold tracking-tight text-slate-800 hidden sm:block">
              月度自评生成器
            </h1>
            <div className="sm:hidden text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              第 {step} 步 / 3
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 text-[13px] font-medium absolute left-1/2 -translate-x-1/2">
            <div className={`flex items-center gap-1.5 transition-colors ${step >= 1 ? "text-slate-900" : "text-slate-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>1</span>
              <span className="hidden sm:inline">准备材料</span>
            </div>
            <span className="text-slate-300 mx-0.5">/</span>
            <div className={`flex items-center gap-1.5 transition-colors ${step >= 2 ? "text-slate-900" : "text-slate-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 2 ? "bg-blue-100 text-blue-700" : (step > 2 ? "bg-slate-100 text-slate-500" : "bg-slate-100/50")}`}>2</span>
              <span className="hidden sm:inline">AI 生成</span>
            </div>
            <span className="text-slate-300 mx-0.5">/</span>
            <div className={`flex items-center gap-1.5 transition-colors ${step >= 3 ? "text-slate-900" : "text-slate-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 3 ? "bg-blue-100 text-blue-700" : "bg-slate-100/50"}`}>3</span>
              <span className="hidden sm:inline">结果导出</span>
            </div>
          </div>

          <div className="flex items-center">
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger>
                <div className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors">
                  <Settings className="w-5 h-5" />
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-[24px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-gradient-to-b from-slate-50 to-white p-6 border-b border-slate-100">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                        <Cpu className="w-5 h-5" />
                      </div>
                      模型配置
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                      配置您的 AI 服务商及 API 密钥，该配置将保存在您的浏览器本地。
                    </DialogDescription>
                  </DialogHeader>
                </div>
                
                <div className="p-6 space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="provider" className="text-slate-700 font-semibold text-sm">AI 服务商</Label>
                    <Select 
                      value={providerId} 
                      onValueChange={(val: any) => {
                        if (val) {
                          setProviderId(val);
                          const provider = AI_PROVIDERS.find(p => p.id === val);
                          if (provider) {
                            setBaseURL(provider.defaultBaseUrl || "");
                            setModelName(provider.defaultModel || "");
                          }
                        }
                      }}
                    >
                      <SelectTrigger id="provider" className="h-11 border-slate-200 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all">
                        <span className="text-slate-700 font-medium">
                          {AI_PROVIDERS.find(p => p.id === providerId)?.name || "选择 AI 服务商"}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl p-1 min-w-[320px]">
                        {AI_PROVIDERS.map(provider => (
                          <SelectItem key={provider.id} value={provider.id} className="cursor-pointer py-2.5 px-3 focus:bg-blue-50 focus:text-blue-700 rounded-lg font-medium text-slate-700">
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="apiKey" className="text-slate-700 font-semibold text-sm">
                      API 密钥 <span className="text-red-500 font-normal ml-0.5">*</span>
                    </Label>
                    <Input 
                      id="apiKey" 
                      type="password" 
                      placeholder={`请输入 ${AI_PROVIDERS.find(p => p.id === providerId)?.name?.split(' ')[0] || ''} API Key`}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-11 border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-mono text-sm placeholder:font-sans placeholder:text-slate-400"
                    />
                  </div>

                  {providerId === "custom" && (
                    <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label htmlFor="baseURL" className="text-slate-700 font-semibold text-sm">自定义 Base URL</Label>
                      <Input 
                        id="baseURL" 
                        placeholder="https://api.openai.com/v1" 
                        value={baseURL}
                        onChange={(e) => setBaseURL(e.target.value)}
                        className="h-11 border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-mono text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <Label htmlFor="modelName" className="text-slate-700 font-semibold text-sm flex items-center justify-between">
                      <span>模型名称</span>
                    </Label>
                    <div className="flex gap-2">
                      {availableModels.length > 0 ? (
                        <Select value={modelName} onValueChange={(val: any) => { if(val) setModelName(val); }}>
                          <SelectTrigger className="flex-1 h-11 border-slate-200 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all">
                            <span className="text-slate-700 font-medium">{modelName}</span>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl p-1 max-h-[250px] min-w-[320px]">
                            {availableModels.map(model => (
                              <SelectItem key={model} value={model} className="cursor-pointer py-2 px-3 focus:bg-blue-50 focus:text-blue-700 rounded-lg font-medium text-slate-700">
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          id="modelName" 
                          placeholder="例如: gpt-4o" 
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                          className="flex-1 h-11 border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-mono text-sm"
                        />
                      )}
                      <Button 
                        variant="outline" 
                        onClick={handleFetchModels}
                        disabled={!apiKey || isFetchingModels}
                        className="h-11 px-3 shrink-0 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                        title="测试连接并获取模型列表"
                      >
                        <RefreshCcw className={`w-4 h-4 ${isFetchingModels ? 'animate-spin text-blue-500' : ''}`} />
                      </Button>
                    </div>
                    {/* Connection Status Feedback */}
                    {connectionStatus !== 'idle' && (
                      <div className={`flex items-start gap-2 text-xs mt-1.5 ${connectionStatus === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {connectionStatus === 'success' ? (
                          <Wifi className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <WifiOff className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="leading-relaxed">{connectionMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsSettingsOpen(false)} className="rounded-xl">取消</Button>
                  <Button onClick={saveSettings} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">保存配置</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6 sm:space-y-8">
        
        {/* Error Toast */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">×</button>
          </div>
        )}

        {step !== 3 && (
          <>
        {/* Step 1: Materials */}
        <div className="space-y-6 transition-opacity duration-500">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-bold text-slate-400 tracking-wider">STEP 1</span>
            <h2 className="text-xl font-bold text-slate-800">上传行事历与材料</h2>
          </div>
          
          <Card className="border border-slate-200/60 shadow-sm shadow-slate-200/20 bg-white rounded-2xl sm:rounded-3xl overflow-hidden">
            <CardContent className="p-1">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-1">
                {/* Basic Info (Moved to Step 1) */}
                <div className="p-5 sm:p-6 md:p-7 bg-white border-b md:border-b-0 md:border-r border-slate-100 md:col-span-2 flex flex-col justify-center">
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-4 bg-blue-500 rounded-full inline-block"></div>
                        基础信息
                      </h3>
                      <p className="text-xs text-slate-500">这些信息将用于表头及辅助生成工作总结</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-semibold text-xs">教师姓名 <span className="text-red-500 font-normal ml-0.5">*</span></Label>
                          <Input 
                            placeholder="如：张三" 
                            value={teacherName}
                            onChange={(e) => setTeacherName(e.target.value)}
                            className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-semibold text-xs">职务 <span className="text-red-500 font-normal ml-0.5">*</span></Label>
                          <Input 
                            placeholder="如：教研组长" 
                            value={teacherTitle}
                            onChange={(e) => setTeacherTitle(e.target.value)}
                            className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold text-xs">所属部门 / 年级组 <span className="text-red-500 font-normal ml-0.5">*</span></Label>
                        <Input 
                          placeholder="如：教务处 / 高一年级组" 
                          value={teacherDepartment}
                          onChange={(e) => setTeacherDepartment(e.target.value)}
                          className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-semibold text-xs">任教学科 <span className="text-red-500 font-normal ml-0.5">*</span></Label>
                          <Input 
                            placeholder="如：语文" 
                            value={teacherSubject}
                            onChange={(e) => setTeacherSubject(e.target.value)}
                            className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-semibold text-xs">教学年级 <span className="text-red-500 font-normal ml-0.5">*</span></Label>
                          <Select value={teacherGrade} onValueChange={(val) => { if(val) setTeacherGrade(val); }}>
                            <SelectTrigger className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm">
                              <SelectValue placeholder="选择年级" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="无教学班" className="rounded-lg text-sm">无教学班</SelectItem>
                              <SelectItem value="一年级" className="rounded-lg text-sm">一年级</SelectItem>
                              <SelectItem value="二年级" className="rounded-lg text-sm">二年级</SelectItem>
                              <SelectItem value="三年级" className="rounded-lg text-sm">三年级</SelectItem>
                              <SelectItem value="四年级" className="rounded-lg text-sm">四年级</SelectItem>
                              <SelectItem value="五年级" className="rounded-lg text-sm">五年级</SelectItem>
                              <SelectItem value="六年级" className="rounded-lg text-sm">六年级</SelectItem>
                              <SelectItem value="初一" className="rounded-lg text-sm">初一</SelectItem>
                              <SelectItem value="初二" className="rounded-lg text-sm">初二</SelectItem>
                              <SelectItem value="初三" className="rounded-lg text-sm">初三</SelectItem>
                              <SelectItem value="高一" className="rounded-lg text-sm">高一</SelectItem>
                              <SelectItem value="高二" className="rounded-lg text-sm">高二</SelectItem>
                              <SelectItem value="高三" className="rounded-lg text-sm">高三</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold text-xs">任教班级（可多个）</Label>
                        <Input 
                          placeholder="如：初一1班、初一2班（多个请用顿号或逗号分隔）" 
                          value={teacherClasses}
                          onChange={(e) => setTeacherClasses(e.target.value)}
                          className="h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Area */}
                <div className="p-4 sm:p-6 md:p-7 bg-slate-50/50 rounded-2xl md:rounded-[22px] border border-transparent md:col-span-3">
                  <div
                    {...getRootProps()}
                    className={`h-full min-h-[160px] sm:min-h-[180px] md:min-h-[210px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-5 sm:p-6 md:p-8 text-center cursor-pointer transition-all ${
                      isDragActive 
                        ? "border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner" 
                        : "border-slate-200 hover:border-blue-400/60 hover:bg-white"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                      <FileUp className={`w-7 h-7 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                    </div>
                    <p className="text-slate-700 font-semibold text-base">拖拽文件到此处，或点击上传</p>
                    <p className="text-slate-400 text-sm mt-2">支持 PDF, Word (.docx), TXT 格式</p>
                  </div>
                </div>

                {/* Extra Instructions & Files List */}
                <div className="p-5 sm:p-6 md:p-7 flex flex-col gap-5 md:gap-6 md:col-span-5 border-t border-slate-100 bg-white">
                  <div className="space-y-3">
                    <Label className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-slate-400" />
                      额外补充说明
                    </Label>
                    <Textarea 
                      placeholder="如果有行事历中未体现的工作，可以在此补充。例如：本月额外完成了校园安全检查报告..."
                      className="min-h-[120px] border-slate-200 bg-slate-50 focus:bg-white focus:ring-blue-500/50 focus:border-blue-500 rounded-xl transition-all resize-none text-sm p-4 leading-relaxed placeholder:text-slate-400"
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                    />
                  </div>

                  {materials.length > 0 && (
                    <div className="space-y-3 flex-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-slate-700 font-semibold text-sm">已解析文件 ({materials.length})</Label>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                        {materials.map((m, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-slate-200">
                            <div className="p-1.5 bg-emerald-50 rounded-lg shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium flex-1 truncate text-slate-700">{m.filename}</span>
                            <span className="text-xs text-slate-400 font-mono shrink-0 bg-slate-50 px-2 py-1 rounded-md">{m.content.length} 字符</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: AI Config */}
        <div className="space-y-6 transition-all duration-500">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-bold text-slate-400 tracking-wider">STEP 2</span>
            <h2 className="text-xl font-bold text-slate-800">生成设置</h2>
          </div>

          <Card className="border border-slate-200/60 shadow-sm shadow-slate-200/20 bg-white rounded-2xl sm:rounded-3xl overflow-hidden">
            <CardContent className="p-5 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full inline-block"></div>
                    部门事项清单（可编辑）
                  </h3>
                  {checklistItems.length > 0 && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      共 {checklistItems.length} 条事项
                    </span>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                  {checklistItems.length > 0 ? (
                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                      {checklistItems.map((item) => (
                        <div key={`${item.index}-${item.title}`} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {item.index}
                            </div>
                            <div className="space-y-2 min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-800 leading-snug">{item.title}</div>
                              {item.action ? (
                                <div className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">{item.action}</div>
                              ) : (
                                <div className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">{item.full}</div>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {item.role && (
                                  <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                    {item.role}
                                  </span>
                                )}
                                {item.mapping && (
                                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                                    {item.mapping}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 py-6 text-center">
                      先点击“生成事项清单”，系统会自动形成结构化清单预览
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 tracking-wide">清单编辑区</span>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1 inline-block">
                      先生成事项清单，再生成正式自评表
                    </p>
                  </div>
                  <Button
                    onClick={handlePrepareChecklist}
                    disabled={isPreparingChecklist || isParsing || materials.length === 0 || !apiKey}
                    className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all hover:-translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                  >
                    {isPreparingChecklist ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在生成清单
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {curatedChecklist.trim() ? "重新生成事项清单" : "先生成事项清单（必做）"}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  placeholder="先点击“生成事项清单”，AI 会基于附件材料提取部门和行政职务相关事项；你可以在这里修改后再生成正式自评表。"
                  className="min-h-[130px] sm:min-h-[150px] md:min-h-[170px] border-slate-200 bg-white focus:bg-white focus:ring-blue-500/50 focus:border-blue-500 rounded-xl transition-all resize-y text-sm p-4 leading-relaxed placeholder:text-slate-400"
                  value={curatedChecklist}
                  onChange={(e) => setCuratedChecklist(e.target.value)}
                />
              </div>
              
              {/* Generate Config Section */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-purple-500 rounded-full inline-block"></div>
                    生成长度控制
                  </h3>
                </div>
                
                <RadioGroup 
                  value={generationLength} 
                  onValueChange={setGenerationLength}
                  className="grid grid-cols-3 gap-4"
                >
                  {[
                    { id: '简略', label: '简略 (大纲式)', desc: '要点清晰，适合快读阅读' },
                    { id: '适中', label: '适中 (推荐)', desc: '内容详实，符合常规汇报' },
                    { id: '详细', label: '详细 (丰富扩展)', desc: '深度展开，适合重点汇报' }
                  ].map((option) => {
                    const isSelected = generationLength === option.id;
                    return (
                      <div key={option.id}>
                        <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                        <Label
                          htmlFor={option.id}
                          className={`flex flex-col items-center justify-center rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                            isSelected 
                              ? "border-blue-600 bg-blue-50/50 shadow-sm shadow-blue-500/10 ring-1 ring-blue-600/20" 
                              : "border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200"
                          }`}
                        >
                          <span className={`font-bold mb-1 transition-colors ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                            {option.label}
                          </span>
                          <span className={`text-xs font-normal transition-colors ${isSelected ? "text-blue-600/70" : "text-slate-500"}`}>
                            {option.desc}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 flex flex-col gap-4">
                <div className="text-sm text-slate-500 flex items-center gap-2 justify-between">
                  <Cpu className="w-4 h-4" />
                  <div className="flex items-center gap-1 flex-wrap">
                    当前模型: <span className="font-semibold text-slate-700">{modelName || '未配置'}</span>
                    <Button variant="link" onClick={() => setIsSettingsOpen(true)} className="h-auto p-0 text-blue-600 ml-1">修改设置</Button>
                  </div>
                </div>
                
                <Button 
                  className={`w-full h-11 sm:h-12 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold shadow-lg transition-all active:scale-[0.98] ${
                    isGenerating || isPreparingChecklist || isParsing || materials.length === 0 || !apiKey || !curatedChecklist.trim()
                      ? 'bg-slate-100 text-slate-400 shadow-none'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5'
                  }`}
                  disabled={isGenerating || isPreparingChecklist || isParsing || materials.length === 0 || !apiKey || !curatedChecklist.trim()}
                  onClick={() => {
                    setStep(2);
                    handleGenerate();
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      正在智能分析与填写...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5 text-amber-300" />
                      开始生成自评表
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
          </>
        )}

        {/* Step 3: Review & Edit */}
        {step === 3 && formData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-4">
            <div className="flex items-center px-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-500 tracking-wider">STEP 3</span>
                <h2 className="text-xl font-bold text-slate-800">检查与导出</h2>
              </div>
            </div>

            <Card className="overflow-hidden border border-slate-200/60 shadow-xl shadow-slate-200/40 bg-white rounded-3xl">
              <div className="bg-slate-50/80 p-6 border-b border-slate-100 flex items-center justify-center">
                <h3 className="font-bold text-lg tracking-tight text-slate-800">行政干部主动工作自主发展月自评表</h3>
              </div>
              <CardContent className="p-0">
                <div className="p-6 md:p-10 space-y-12">
                  
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">年份</Label>
                      <Input value={formData.year} onChange={e => updateFormData('year', e.target.value)} className="h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-medium text-slate-800 text-center" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">月份</Label>
                      <Input value={formData.month} onChange={e => updateFormData('month', e.target.value)} className="h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-medium text-slate-800 text-center" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">日</Label>
                      <Input value={formData.day} onChange={e => updateFormData('day', e.target.value)} className="h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-medium text-slate-800 text-center" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">部门</Label>
                      <Input value={formData.department} onChange={e => updateFormData('department', e.target.value)} className="h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-medium text-slate-800 text-center" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">姓名</Label>
                      <Input value={formData.name} onChange={e => updateFormData('name', e.target.value)} className="h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-medium text-slate-800 text-center" />
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  {/* 常规工作 */}
                  <div className="space-y-5">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">📊</div>
                      常规工作力度
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-6 rounded-[20px] border border-slate-100">
                      {[
                        { label: '观课议课（节）', key: 'lessonObservation' },
                        { label: '参加校本教研（次）', key: 'schoolTeachingActivity' },
                        { label: '示范开课（节）', key: 'demoLesson' },
                        { label: '上交议题（个）', key: 'submittedTopics' },
                        { label: '值日（次）', key: 'dutyDays' },
                        { label: '主动参与活动（次）', key: 'otherActivities' },
                        { label: '上交案例叙事等（篇）', key: 'submittedCases' },
                        { label: '讲座（场）', key: 'lectures' }
                      ].map(item => (
                        <div key={item.key} className="space-y-2 bg-white p-3 rounded-xl shadow-sm border border-slate-100/50">
                          <Label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block text-center mb-1">{item.label}</Label>
                          <Input 
                            value={formData[item.key as keyof MonthlySummaryForm]} 
                            onChange={e => updateFormData(item.key as keyof MonthlySummaryForm, e.target.value)} 
                            className="h-10 bg-slate-50/50 border-transparent hover:bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg text-center font-semibold text-slate-700 text-lg transition-all" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  {/* 文字描述 */}
                  <div className="space-y-6">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs">📝</div>
                      核心工作详述
                    </h4>
                    
                    {[
                      { label: '本月工作亮点或创新', key: 'highlightsOrInnovations' },
                      { label: '本月发现问题或解决问题描述', key: 'problemsOrSolutions' },
                      { label: '下月工作改进措施', key: 'nextMonthImprovements' },
                      { label: '学习内容', key: 'learningContent' },
                      { label: '本月本学科教学情况', key: 'teachingSituation' }
                    ].map(item => (
                      <div key={item.key} className="space-y-2 group">
                        <Label className="text-slate-700 font-bold text-sm ml-1">{item.label}</Label>
                        <Textarea 
                          className="min-h-[100px] bg-slate-50 border-transparent hover:bg-slate-100/80 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl resize-y text-[15px] p-5 leading-relaxed text-slate-700 transition-all shadow-sm shadow-slate-200/20" 
                          value={formData[item.key as keyof MonthlySummaryForm]} 
                          onChange={e => updateFormData(item.key as keyof MonthlySummaryForm, e.target.value)} 
                        />
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-slate-100" />

                  {/* 总体评价 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 p-6 md:p-8 rounded-[24px] border border-indigo-100/50">
                    <div>
                      <Label className="text-indigo-900 font-bold text-lg block mb-1">
                        本月对自我总体评价
                      </Label>
                      <p className="text-indigo-700/70 text-sm">在“优秀、合格、待合格”中客观评价本月表现</p>
                    </div>
                    <Select value={formData.selfEvaluation} onValueChange={(val: any) => updateFormData('selfEvaluation', val)}>
                      <SelectTrigger className="w-full sm:w-[200px] h-12 bg-white border-transparent shadow-sm focus:ring-2 focus:ring-indigo-500/20 rounded-xl font-bold text-indigo-900 text-base">
                        <span className="flex-1 text-center">
                          {formData.selfEvaluation || "选择评价"}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl p-1">
                        <SelectItem value="优秀" className="py-3 focus:bg-indigo-50 font-bold text-indigo-900 text-center justify-center rounded-lg cursor-pointer">优秀</SelectItem>
                        <SelectItem value="合格" className="py-3 focus:bg-indigo-50 font-bold text-slate-700 text-center justify-center rounded-lg cursor-pointer">合格</SelectItem>
                        <SelectItem value="待合格" className="py-3 focus:bg-indigo-50 font-bold text-slate-500 text-center justify-center rounded-lg cursor-pointer">待合格</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </CardContent>
            </Card>
            <div className="sticky bottom-4 z-40">
              <div className="bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-xl shadow-slate-300/20 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="h-11 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 sm:flex-1"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    修改配置
                  </Button>
                  <Button
                    onClick={handleDownload}
                    className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 text-white transition-all hover:-translate-y-0.5 sm:flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出 Word
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
