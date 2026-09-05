const electronInstaller = require('electron-winstaller');
const path = require('path');

async function createInstaller() {
  console.log('Starting professional Windows Setup compilation (Squirrel)...');
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, 'dist', 'WhisperIO-win32-x64'),
      outputDirectory: path.join(__dirname, 'dist', 'installers'),
      authors: 'Harsh',
      exe: 'WhisperIO.exe',
      setupExe: 'WhisperIOSetup.exe',
      noMsi: true,
      description: 'Dynamic Island AI Dictation Capsule for Windows powered by Groq & Whisper'
    });
    console.log('\n==================================================================');
    console.log('🎉 SUCCESS: WhisperIOSetup.exe has been compiled successfully!');
    console.log('📂 Location: dist/installers/WhisperIOSetup.exe');
    console.log('==================================================================\n');
  } catch (e) {
    console.error(`\n❌ ERROR: Failed to create installer: ${e.message}\n`);
  }
}

createInstaller();
