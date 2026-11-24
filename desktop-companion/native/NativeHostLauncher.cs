using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

internal static class NativeHostLauncher {
    private static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
    private static void Pump(Stream source, Stream destination) {
        var buffer = new byte[4096];
        int count;
        while ((count = source.Read(buffer, 0, buffer.Length)) > 0) {
            destination.Write(buffer, 0, count);
            destination.Flush();
        }
    }
    public static int Main(string[] args) {
        try {
            string desktop = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            string runtime = Path.GetFullPath(Path.Combine(desktop, "..", "..", "runtime", "electron.exe"));
            var start = new ProcessStartInfo(runtime, Quote(Path.Combine(desktop, "native-host.cjs")) + " " + string.Join(" ", args.Select(Quote))) {
                WorkingDirectory = desktop, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
            };
            start.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            using (var child = Process.Start(start)) {
                Task.Factory.StartNew(() => { try { Pump(Console.OpenStandardInput(), child.StandardInput.BaseStream); } finally { try { child.StandardInput.Close(); } catch { } } });
                var output = Task.Factory.StartNew(() => Pump(child.StandardOutput.BaseStream, Console.OpenStandardOutput()));
                var error = Task.Factory.StartNew(() => Pump(child.StandardError.BaseStream, Console.OpenStandardError()));
                child.WaitForExit(); output.Wait(); error.Wait(); return child.ExitCode;
            }
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
