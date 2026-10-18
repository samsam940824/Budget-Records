import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { clearPasscode, getLockConfig, setLockTimeout, setPasscode, verifyPasscode } from '../../lib/lock';
import { Card, FieldRow, Toggle } from '../../components/ui';
import PasscodePad from '../security/PasscodePad';

type Step = 'idle' | 'new' | 'confirm' | 'disable';

const TIMEOUTS = [
    { value: 0, label: '立即' },
    { value: 1, label: '1 分鐘' },
    { value: 5, label: '5 分鐘' },
    { value: 15, label: '15 分鐘' },
];

export default function PasscodeSettings({ onBack }: { onBack: () => void }) {
    const [config, setConfig] = useState(getLockConfig);
    const [step, setStep] = useState<Step>('idle');
    const [value, setValue] = useState('');
    const [first, setFirst] = useState('');
    const [error, setError] = useState<string | null>(null);

    const reset = () => { setStep('idle'); setValue(''); setFirst(''); setError(null); };

    if (step !== 'idle') {
        const titles = { new: '設定 4 位數密碼', confirm: '再輸入一次', disable: '輸入目前密碼' };
        return (
            <div className="pt-20 px-4 pb-28 flex flex-col items-center animate-in fade-in">
                <PasscodePad
                    title={titles[step]}
                    subtitle={step === 'disable' ? '以關閉密碼鎖' : '只會存在這台裝置'}
                    value={value}
                    error={error}
                    onChange={v => { setValue(v); if (v) setError(null); }}
                    onComplete={async code => {
                        if (step === 'new') { setFirst(code); setValue(''); setStep('confirm'); return; }
                        if (step === 'confirm') {
                            if (code !== first) { setError('兩次輸入不一致，請重新設定'); setValue(''); setFirst(''); setStep('new'); return; }
                            await setPasscode(code, config?.timeoutMinutes ?? 1);
                            setConfig(getLockConfig());
                            reset();
                            return;
                        }
                        if (await verifyPasscode(code)) { clearPasscode(); setConfig(null); reset(); }
                        else { setError('密碼錯誤'); setValue(''); }
                    }}
                />
                <button onClick={reset} className="mt-8 text-zinc-400 text-sm">取消</button>
            </div>
        );
    }

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-bold text-white">密碼鎖</h1>
            </div>
            <Card className="p-2 mb-4">
                <FieldRow label="開啟密碼鎖" last={!config}>
                    <Toggle checked={!!config} onChange={on => setStep(on ? 'new' : 'disable')} label="開啟密碼鎖" />
                </FieldRow>
                {config && (
                    <>
                        <FieldRow label="離開多久後上鎖">
                            <select
                                value={config.timeoutMinutes}
                                onChange={e => { setLockTimeout(Number(e.target.value)); setConfig(getLockConfig()); }}
                                className="bg-transparent text-right text-white outline-none appearance-none"
                                aria-label="自動上鎖時間"
                            >
                                {TIMEOUTS.map(t => <option key={t.value} value={t.value} className="bg-zinc-900">{t.label}</option>)}
                            </select>
                        </FieldRow>
                        <button onClick={() => setStep('new')} className="w-full text-left p-3 text-emerald-400 font-medium">變更密碼</button>
                    </>
                )}
            </Card>
            <p className="text-zinc-500 text-xs px-1">密碼只存在這台裝置的瀏覽器裡，用來避免別人拿起手機就看到帳目。帳本資料本身仍由登入帳號保護。忘記密碼時可以登出再登入來重設。</p>
        </div>
    );
}
