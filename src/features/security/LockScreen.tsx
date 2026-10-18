import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { clearPasscode, verifyPasscode } from '../../lib/lock';
import PasscodePad from './PasscodePad';

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6" role="dialog" aria-label="輸入密碼">
            <PasscodePad
                title="輸入密碼"
                subtitle="解鎖 Budget Records"
                value={value}
                error={error}
                onChange={v => { setValue(v); if (v) setError(null); }}
                onComplete={async code => {
                    if (await verifyPasscode(code)) onUnlock();
                    else { setError('密碼錯誤'); setValue(''); }
                }}
            />
            <button
                onClick={async () => {
                    // Signing in again proves ownership, so the device lock can be reset.
                    clearPasscode();
                    await supabase.auth.signOut();
                    onUnlock();
                }}
                className="mt-10 text-sm text-zinc-500"
            >
                忘記密碼？登出並重設
            </button>
        </div>
    );
}
