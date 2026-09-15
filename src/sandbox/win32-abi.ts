/**
 * Win32 常量与 x64 结构体尺寸。
 *
 * 单独成文件的理由：这些值是**外部契约**（Windows SDK 头文件），不是我们的设计。
 * 混在逻辑里会让人以为可以按需调整 —— 改错一个位就是静默的安全洞
 * （例如 GRANT_MASK 若漏掉 `& ~STANDARD_RIGHTS_WRITE`，子进程就能改 DACL 逃逸）。
 *
 * 尺寸类常量（*_SIZE / *_OFFSET）都在 ffi.ts 里有 koffi 布局断言兜底：
 * koffi 算出的结构体大小与这里不符即 throw，不让错误布局悄悄跑起来。
 * 已在 koffi 3.3.0 / Win11 x64 实测：STARTUPINFOW = 104、EXPLICIT_ACCESS_W = 48。
 *
 * 值的来源：dsh 的 win32-abi.ts 与 win32-process/abi.ts（MIT），
 * 逐条对照 Windows SDK 复核。
 */

/* ── 令牌 ────────────────────────────────────────────────────────── */

/** OpenProcess 查询当前进程令牌所需的访问权。 */
export const PROCESS_QUERY_INFORMATION = 0x0400;
/** OpenProcess 只查询基本信息（Job 归属等）所需的访问权。 */
export const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
/** CreateProcessAsUserW 要求的令牌权限。 */
export const TOKEN_ASSIGN_PRIMARY = 0x0001;
/** CreateRestrictedToken 要求的令牌权限。 */
export const TOKEN_DUPLICATE = 0x0002;
/** 读取令牌信息所需权限。 */
export const TOKEN_QUERY = 0x0008;
/** 替换令牌默认 DACL 所需权限（setTokenDefaultDaclGrant 用）。 */
export const TOKEN_ADJUST_DEFAULT = 0x0080;

/**
 * 标识登录会话 SID 的组属性。
 *
 * **第 31 位是 1**，而 JS 的位运算是有符号 32 位 —— 比较时必须 `>>> 0` 两边，
 * 否则永远匹配不上（踩过）。
 */
export const SE_GROUP_LOGON_ID = 0xc0000000;

/** CreateRestrictedToken：禁用最大特权。 */
export const DISABLE_MAX_PRIVILEGE = 0x1;
/** CreateRestrictedToken：受限用户令牌。 */
export const LUA_TOKEN = 0x4;
/**
 * CreateRestrictedToken：**只把写访问**限制到受限 SID 列表内。
 *
 * 这个「只管写」是整套方案的能力边界，也是我们的沙箱只能报 partial 的根因：
 * 读与 socket 完全不受影响（已实测：受限子进程仍能读工作区外文件）。
 * 所以 command-guard 的凭据拦截不能因为「有沙箱了」而削弱。
 */
export const WRITE_RESTRICTED = 0x8;

/** WELL_KNOWN_SID_TYPE：Everyone。 */
export const WinWorldSid = 1;
/** TOKEN_INFORMATION_CLASS：令牌组。 */
export const TokenGroups = 2;
/** TOKEN_INFORMATION_CLASS：令牌默认 DACL。 */
export const TokenDefaultDacl = 6;

/* ── 访问掩码 ────────────────────────────────────────────────────── */

/** 标准写权限位（含 WRITE_DAC / WRITE_OWNER），要从授权掩码里剔掉。 */
export const STANDARD_RIGHTS_WRITE = 0x00020000;
/** 通用文件写权限。 */
export const FILE_GENERIC_WRITE = 0x00120116;
/** 删除或重命名对象。 */
export const DELETE = 0x00010000;
/** 删除目录子项。 */
export const FILE_DELETE_CHILD = 0x0040;

/**
 * 授给 capability SID 的掩码：写 + 删除 + 删子项。
 *
 * **`& ~STANDARD_RIGHTS_WRITE` 不能省**：它剔掉 WRITE_DAC 与 WRITE_OWNER，
 * 否则受限子进程能改写工作区自己的 DACL 或夺取所有权，一步逃出授权范围 ——
 * 那样这层就成了假边界。
 *
 * 注意与 codex 的一处差异（它有意为之，我们照做）：**不在父目录上授
 * FILE_DELETE_CHILD 之外的删除权**，逐子项授 DELETE —— 父目录的 DELETE_CHILD
 * 会绕过子项上的 deny ACE。我们本期没有 deny ACE，但保持同样的掩码形状。
 */
export const GRANT_MASK = (FILE_GENERIC_WRITE | DELETE | FILE_DELETE_CHILD) & ~STANDARD_RIGHTS_WRITE;

/** 受限令牌默认 DACL 里用的全权访问（见 setTokenDefaultDaclGrant）。 */
export const FILE_ALL_ACCESS = 0x1f01ff;

/* ── ACL / 安全描述符 ────────────────────────────────────────────── */

/** SECURITY_INFORMATION：选择 DACL。 */
export const DACL_SECURITY_INFORMATION = 0x00000004;
/** SE_OBJECT_TYPE：文件系统对象。 */
export const SE_FILE_OBJECT = 1;
/** TRUSTEE_TYPE：不分类。 */
export const TRUSTEE_IS_UNKNOWN = 0;
/** TRUSTEE_FORM：受托者是 SID 指针。 */
export const TRUSTEE_IS_SID = 0;
/** 受托者记录不串联下一个。 */
export const NO_MULTIPLE_TRUSTEE = 0;
/** EXPLICIT_ACCESS 模式：授予。 */
export const GRANT_ACCESS = 1;
/** EXPLICIT_ACCESS 模式：撤销（移除该受托者的全部 ACE）。 */
export const REVOKE_ACCESS = 4;
/** ACE 继承标志：子容器与子对象都继承（OI | CI）。 */
export const SUB_CONTAINERS_AND_OBJECTS_INHERIT = 0x3;
/** 允许型 ACE。 */
export const ACCESS_ALLOWED_ACE_TYPE = 0;
/** SID 子权限数量上限（用于 sameSidAt 的边界校验）。 */
export const SID_MAX_SUB_AUTHORITIES = 15;
/** SID 分配上限（字节）。 */
export const SECURITY_MAX_SID_SIZE = 68;

/* ── 文件锁（ACL 编辑的并发保护） ───────────────────────────────── */

export const GENERIC_READ = 0x80000000;
export const GENERIC_WRITE = 0x40000000;
export const FILE_SHARE_READ = 0x00000001;
export const FILE_SHARE_WRITE = 0x00000002;
/** CreateFile 处置方式：打开或创建。 */
export const OPEN_ALWAYS = 4;
/**
 * 传统 Win32 路径长度上限。
 *
 * 只用于 GetTempPathW 的缓冲尺寸（MSDN 要求给 MAX_PATH+1 字符，
 * 留出尾部反斜杠与 NUL）。我们不用它校验任何路径 —— Windows 早已支持长路径，
 * 拿 260 当路径校验上限会误伤合法的深层目录。
 */
export const MAX_PATH = 260;
/** LockFileEx：独占锁。 */
export const LOCKFILE_EXCLUSIVE_LOCK = 0x2;

/* ── 进程与 stdio ────────────────────────────────────────────────── */

/** STARTUPINFOW 使用 hStd* 字段。 */
export const STARTF_USESTDHANDLES = 0x00000100;
/** 句柄可被子进程继承。 */
export const HANDLE_FLAG_INHERIT = 0x00000001;
/** 挂起创建（Job Object 装配用：先挂起 → 入 Job → 再恢复）。 */
export const CREATE_SUSPENDED = 0x4;
/**
 * 让新进程**脱离**调用方所在的 Job（Job 未禁止 breakaway 时）。
 *
 * 用途：IDE/终端会把整棵进程树放进 Job；若那个 Job 带 UI 限制，
 * 受限令牌子进程被自动拉进去后 USER32 初始化会失败（0xC0000142）。
 * 诊断矩阵用它判别「Job 是否为成因」。
 */
export const CREATE_BREAKAWAY_FROM_JOB = 0x01000000;

/** JOBOBJECTINFOCLASS：基本 UI 限制。 */
export const JobObjectBasicUIRestrictions = 4;
/** UI 限制位：只能用 Job 句柄表里已有的 USER 对象句柄（打击桌面/窗口站访问）。 */
export const JOB_OBJECT_UILIMIT_HANDLES = 0x1;
/** UI 限制位：禁止读剪贴板。 */
export const JOB_OBJECT_UILIMIT_READCLIPBOARD = 0x2;
/** UI 限制位：禁止写剪贴板。 */
export const JOB_OBJECT_UILIMIT_WRITECLIPBOARD = 0x4;
/** UI 限制位：禁止改系统参数。 */
export const JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS = 0x8;
/** UI 限制位：禁止改显示设置。 */
export const JOB_OBJECT_UILIMIT_DISPLAYSETTINGS = 0x10;
/** UI 限制位：隔离全局原子表。 */
export const JOB_OBJECT_UILIMIT_GLOBALATOMS = 0x20;

/**
 * 环境块按 UTF-16 解释。
 *
 * **本项目相对 dsh 的有意偏离。** dsh 在 process.ts / runner.ts 两处注明
 * 「显式传环境块会 ERROR_INVALID_PARAMETER，已实测」，因此改去修改自己进程的
 * TMP/TEMP 让子进程继承 —— 那条路我们不能走（会污染整个 daemon 的环境，
 * 影响所有会话）。
 *
 * 实测（spike 两次对照）证明那条归因是错的：根因就是漏了这个标志。
 * lpEnvironment 默认按 ANSI 解释，传 UTF-16 块必然被判非法参数；
 * 置上标志后显式环境块完全正常。dsh 的 abi.ts 里确实没有这个常量。
 */
export const CREATE_UNICODE_ENVIRONMENT = 0x400;

/**
 * WaitForSingleObject：对象已就绪。
 *
 * 我们**只用超时 0 的轮询**，从不传 INFINITE —— 那会同步阻塞 daemon 线程，
 * 把所有会话一起冻住（dsh 可以阻塞是因为它跑在独立的 runner 进程里）。
 */
export const WAIT_OBJECT_0 = 0;
/** WaitForSingleObject：超时未就绪（进程仍在运行）。 */
export const WAIT_TIMEOUT = 0x102;
/** WaitForSingleObject / ResumeThread 的失败返回值。 */
export const WAIT_FAILED = 0xffffffff;

/* ── Job Object（超时杀进程树） ─────────────────────────────────── */

/** JOBOBJECTINFOCLASS：扩展限制信息。 */
export const JobObjectExtendedLimitInformation = 9;
/** Job 句柄关闭时杀掉全部成员进程 —— 超时能连孙进程一起收掉的关键。 */
export const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

/**
 * x64 JOBOBJECT_EXTENDED_LIMIT_INFORMATION 尺寸。
 *
 * 推导：BASIC_LIMIT_INFORMATION 64（两个 LARGE_INTEGER 16 + LimitFlags 4 + 填充 4
 * + 两个 SIZE_T 16 + ActiveProcessLimit 4 + 填充 4 + Affinity 8 + 两个 DWORD 8）
 * + IO_COUNTERS 48（6 × ULONGLONG）+ 四个 SIZE_T 32 = 144。
 *
 * 算错不会静默：SetInformationJobObject 的返回值我们逐个检查，
 * 尺寸不对会响亮失败而不是配错限制。
 */
export const JOBOBJECT_EXTENDED_LIMIT_SIZE = 144;
/** LimitFlags 在 JOBOBJECT_EXTENDED_LIMIT_INFORMATION 里的字节偏移（两个 LARGE_INTEGER 之后）。 */
export const JOBOBJECT_EXTENDED_LIMIT_FLAGS_OFFSET = 16;

/* ── 结构体尺寸与偏移（koffi 布局断言的期望值） ─────────────────── */

/** x64 STARTUPINFOW 字节数（实测 koffi 3.3.0 算出 104，相符）。 */
export const STARTUPINFOW_SIZE = 104;
/** x64 PROCESS_INFORMATION 字节数（两个指针 + 两个 DWORD）。 */
export const PROCESS_INFORMATION_SIZE = 24;
/** x64 SID_AND_ATTRIBUTES 步长（SID 指针 8 + 属性 4 + 填充 4）。 */
export const SID_AND_ATTRIBUTES_SIZE = 16;
/** x64 TOKEN_GROUPS 里第一个组条目的偏移（GroupCount 4 + 填充 4）。 */
export const TOKEN_GROUPS_OFFSET = 8;
/** x64 EXPLICIT_ACCESS_W 字节数（abi 探针实测）。 */
export const EXPLICIT_ACCESS_W_SIZE = 48;

/* ── 错误码 ──────────────────────────────────────────────────────── */

export const ERROR_SUCCESS = 0;
/** 尺寸查询时的预期失败（先问长度再分配的两段式调用）。 */
export const ERROR_INSUFFICIENT_BUFFER = 122;
/** 管道写端已关闭 —— drainPipe 的正常终止条件之一。 */
export const ERROR_BROKEN_PIPE = 109;
/** 管道暂无数据 —— drainPipe 的正常终止条件之一。 */
export const ERROR_NO_DATA = 232;
/** FormatMessageW：从系统消息表取文案。 */
export const FORMAT_MESSAGE_FROM_SYSTEM = 0x1000;
/** FormatMessageW：忽略插入序列（避免缺参数时抛错）。 */
export const FORMAT_MESSAGE_IGNORE_INSERTS = 0x200;
