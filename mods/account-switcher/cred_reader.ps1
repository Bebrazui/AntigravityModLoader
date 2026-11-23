param([string]$target = 'gemini:antigravity')

$src = @"
using System;
using System.Runtime.InteropServices;
public class CredReader3 {
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
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr buffer);
    public static string Read(string target) {
        IntPtr p;
        bool ok = CredRead(target, 1, 0, out p);
        if (!ok) return null;
        try {
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
            if (c.CredentialBlobSize > 0 && c.CredentialBlob != IntPtr.Zero) {
                byte[] b = new byte[c.CredentialBlobSize];
                Marshal.Copy(c.CredentialBlob, b, 0, c.CredentialBlobSize);
                return System.Text.Encoding.UTF8.GetString(b);
            }
        } finally { CredFree(p); }
        return null;
    }
}
"@
Add-Type -TypeDefinition $src

$res = [CredReader3]::Read($target)
if ($null -ne $res) { [Console]::Out.Write($res) }
