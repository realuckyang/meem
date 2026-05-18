export function codexConfigForMode(mode) {
  if (mode === 'managed') {
    return {
      sandbox: 'danger-full-access',
      approvalPolicy: 'never',
      instruction: '你处于托管模式，已被授予完整机器访问权（读/写/执行/联网）。代表用户完成请求：先动手做（查文件、执行命令、调接口都行），再用一段中文总结你做了什么、看到什么。',
      label: '托管',
    };
  }
  if (mode === 'approval') {
    return {
      sandbox: 'workspace-write',
      approvalPolicy: 'on-request',
      instruction: '你处于审批模式。读全机；写文件、执行命令、对外发送等动作要先请求用户确认。',
      label: '审批',
    };
  }
  return {
    sandbox: 'read-only',
    approvalPolicy: 'never',
    instruction: '你处于观察模式。只读全机（可以执行 ls/cat 类只读命令查机器状态），不修改任何文件、不联网、不对外发送。基于真实查到的信息回答；不要编造。',
    label: '观察',
  };
}
