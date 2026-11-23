param([string]$target = 'gemini:antigravity', [string]$user = 'antigravity', [string]$base64 = '')

$src = @"
using System;
using System.Runtime.InteropServices;
public class CredWriter2 {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] uint flags);

    public static bool Write(string target, string user, string secret) {
        byte[] b = System.Text.Encoding.UTF8.GetBytes(secret);
        IntPtr p = Marshal.AllocHGlobal(b.Length);
        try {
            Marshal.Copy(b, 0, p, b.Length);
            CREDENTIAL c = new CREDENTIAL();
            c.Type = 1; // Generic
            c.TargetName = target;
            c.UserName = user;
            c.CredentialBlobSize = b.Length;
            c.CredentialBlob = p;
            c.Persist = 2; // Local machine persistence
            return CredWrite(ref c, 0);
        } finally {
            Marshal.FreeHGlobal(p);
        }
    }
}
"@
Add-Type -TypeDefinition $src

if ($base64) {
    $bytes = [System.Convert]::FromBase64String($base64)
    $secret = [System.Text.Encoding]::UTF8.GetString($bytes)
    $ok = [CredWriter2]::Write($target, $user, $secret)
    if ($ok) { [Console]::Out.Write('OK') } else { [Console]::Out.Write('ERR') }
}
