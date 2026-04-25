#include <napi.h>
#include <windows.h>
#include <winioctl.h>
#include <string>
#include <vector>
#include <memory>
#include <algorithm>
#include <cstdint>

#pragma comment(lib, "ntdll.lib")

struct FileEntry {
    std::u16string name;
    std::u16string path;
    uint64_t size;
    uint64_t created;
    uint64_t modified;
    uint64_t accessed;
    bool isDirectory;
    uint32_t attributes;
};

inline bool ends_with(const std::u16string& str, const std::u16string& suffix) {
    return str.size() >= suffix.size() && 
           str.compare(str.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::u16string to_lower(const std::u16string& str) {
    std::u16string result = str;
    std::transform(result.begin(), result.end(), result.begin(), 
        [](char16_t c) { return (char16_t)std::tolower((unsigned char)c); });
    return result;
}

class FileIndexer {
private:
    std::vector<FileEntry> files;
    std::vector<std::u16string> indexedVolumes;
    std::vector<std::u16string> excludePatterns;

    bool matchesExclude(const std::u16string& name) {
        std::u16string nameLower = to_lower(name);
        // always exclude hidden (dot) entries
        if (!nameLower.empty() && nameLower[0] == u'.') return true;
        for (const auto& pat : excludePatterns) {
            // simple wildcard: only support leading/trailing * for now
            if (pat.find(u'*') == std::u16string::npos) {
                if (nameLower == pat) return true;
            } else {
                // *.ext pattern
                if (pat.size() > 1 && pat[0] == u'*') {
                    std::u16string suffix = pat.substr(1);
                    if (ends_with(nameLower, suffix)) return true;
                }
            }
        }
        return false;
    }
    
    bool isAdmin() {
        BOOL isAdmin = FALSE;
        PSID administratorsGroup = NULL;
        SID_IDENTIFIER_AUTHORITY ntAuthority = SECURITY_NT_AUTHORITY;
        
        if (AllocateAndInitializeSid(&ntAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
            DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &administratorsGroup)) {
            CheckTokenMembership(NULL, administratorsGroup, &isAdmin);
            FreeSid(administratorsGroup);
        }
        return isAdmin != FALSE;
    }
    
    std::vector<std::u16string> getNTFSVolumes() {
        std::vector<std::u16string> volumes;
        wchar_t volumeName[MAX_PATH];
        wchar_t filesystemName[MAX_PATH];
        DWORD bufferSize = MAX_PATH;
        
        for (wchar_t drive = L'C'; drive <= L'Z'; drive++) {
            std::wstring rootPath = std::wstring(1, drive) + L":\\";
            if (GetDriveTypeW(rootPath.c_str()) == DRIVE_FIXED) {
                if (GetVolumeInformationW(rootPath.c_str(), volumeName, bufferSize,
                    NULL, NULL, NULL, filesystemName, bufferSize)) {
                    if (std::wstring(filesystemName) == L"NTFS") {
                        std::u16string vol;
                        vol.push_back((char16_t)drive);
                        volumes.push_back(vol);
                    }
                }
            }
        }
        return volumes;
    }
    
    std::u16string wstringToU16(const std::wstring& wstr) {
        return std::u16string(wstr.begin(), wstr.end());
    }
    
    std::wstring u16stringToW(const std::u16string& str) {
        return std::wstring(str.begin(), str.end());
    }
    
    void enumerateDirectory(const std::u16string& dirPath, bool recursive) {
        WIN32_FIND_DATAW findData;
        std::wstring wpath = u16stringToW(dirPath) + L"*";
        
        HANDLE hFind = FindFirstFileExW(
            wpath.c_str(),
            FindExInfoBasic,
            &findData,
            FindExSearchNameMatch,
            NULL,
            FIND_FIRST_EX_LARGE_FETCH
        );
        
        if (hFind == INVALID_HANDLE_VALUE) return;
        
        do {
            std::wstring wname = findData.cFileName;
            if (wname == L"." || wname == L"..") continue;
            
            bool isDir = (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
            std::u16string name = wstringToU16(wname);

            if (matchesExclude(name)) continue;

            std::u16string fullPath = dirPath + name;
            
            FileEntry entry;
            entry.name = name;
            entry.path = fullPath;
            entry.size = ((uint64_t)findData.nFileSizeHigh << 32) | findData.nFileSizeLow;
            entry.created = ((uint64_t)findData.ftCreationTime.dwHighDateTime << 32) | 
                          findData.ftCreationTime.dwLowDateTime;
            entry.modified = ((uint64_t)findData.ftLastWriteTime.dwHighDateTime << 32) | 
                            findData.ftLastWriteTime.dwLowDateTime;
            entry.accessed = ((uint64_t)findData.ftLastAccessTime.dwHighDateTime << 32) | 
                            findData.ftLastAccessTime.dwLowDateTime;
            entry.isDirectory = isDir;
            entry.attributes = findData.dwFileAttributes;
            
            files.push_back(entry);
            
            if (isDir && recursive) {
                std::u16string sep = u"\\";
                enumerateDirectory(fullPath + sep, true);
            }
        } while (FindNextFileW(hFind, &findData));
        
        FindClose(hFind);
    }
    
public:
    FileIndexer() {}
    
    void clearIndex() {
        files.clear();
        indexedVolumes.clear();
    }
    
    Napi::Boolean isAdminMode(const Napi::CallbackInfo& info) {
        return Napi::Boolean::New(info.Env(), isAdmin());
    }
    
    Napi::Array getVolumes(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        auto volumes = getNTFSVolumes();
        Napi::Array result = Napi::Array::New(env, volumes.size());
        
        for (size_t i = 0; i < volumes.size(); i++) {
            result.Set(i, volumes[i]);
        }
        return result;
    }
    
    Napi::Array indexDirectory(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "Expected directory path").ThrowAsJavaScriptException();
            return Napi::Array::New(env, 0);
        }

        // Parse excludePatterns (second arg, optional array of strings)
        excludePatterns.clear();
        if (info.Length() >= 2 && info[1].IsArray()) {
            Napi::Array arr = info[1].As<Napi::Array>();
            for (uint32_t i = 0; i < arr.Length(); i++) {
                Napi::Value v = arr.Get(i);
                if (v.IsString()) {
                    excludePatterns.push_back(to_lower(v.As<Napi::String>().Utf16Value()));
                }
            }
        }
        
        std::u16string dirPath = u"\\\\?\\" + info[0].As<Napi::String>().Utf16Value();
        
        if (!ends_with(dirPath, u"\\")) {
            dirPath += u"\\";
        }
        
        files.clear();
        enumerateDirectory(dirPath, true);
        
        Napi::Array result = Napi::Array::New(env, files.size());
        
        for (size_t i = 0; i < files.size(); i++) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("name", Napi::String::New(env, files[i].name));
            obj.Set("path", Napi::String::New(env, files[i].path));
            obj.Set("size", Napi::Number::New(env, (double)files[i].size));
            obj.Set("created", Napi::Number::New(env, (double)files[i].created));
            obj.Set("modified", Napi::Number::New(env, (double)files[i].modified));
            obj.Set("accessed", Napi::Number::New(env, (double)files[i].accessed));
            obj.Set("isDirectory", Napi::Boolean::New(env, files[i].isDirectory));
            obj.Set("attributes", Napi::Number::New(env, files[i].attributes));
            result.Set(i, obj);
        }
        
        return result;
    }
    
    Napi::Array readUSNJournal(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "Expected drive letter").ThrowAsJavaScriptException();
            return Napi::Array::New(env, 0);
        }
        
        std::u16string u16drive = info[0].As<Napi::String>().Utf16Value();
        std::wstring drive = u16stringToW(u16drive);
        std::wstring volumePath = L"\\\\.\\" + drive + L":";
        
        HANDLE hVolume = CreateFileW(
            volumePath.c_str(),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            NULL,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            NULL
        );
        
        if (hVolume == INVALID_HANDLE_VALUE) {
            Napi::TypeError::New(env, "Failed to open volume").ThrowAsJavaScriptException();
            return Napi::Array::New(env, 0);
        }
        
        USN_JOURNAL_DATA journalData;
        DWORD bytesReturned;
        
        if (!DeviceIoControl(hVolume, FSCTL_QUERY_USN_JOURNAL, NULL, 0,
            &journalData, sizeof(journalData), &bytesReturned, NULL)) {
            CloseHandle(hVolume);
            Napi::Array empty = Napi::Array::New(env, 0);
            return empty;
        }
        
        std::vector<FileEntry> changes;
        uint8_t buffer[65536];
        
        struct MY_READ_USN_JOURNAL_DATA {
            ULONGLONG StartUsn;
            DWORD JournalId;
            DWORD Mode;
        } readData = {0};
        readData.JournalId = journalData.UsnJournalID;
        readData.StartUsn = journalData.FirstUsn;
        
        while (true) {
            if (!DeviceIoControl(hVolume, FSCTL_READ_USN_JOURNAL, &readData,
                sizeof(readData), buffer, sizeof(buffer), &bytesReturned, NULL)) {
                break;
            }
            
            if (bytesReturned <= sizeof(USN)) break;
            
            DWORD nextUsn = *(DWORD*)buffer;
            PUSN_RECORD_V2 record = (PUSN_RECORD_V2)(buffer + sizeof(DWORD));
            
            while ((uint8_t*)record < buffer + bytesReturned) {
                if (record->RecordLength == 0) break;
                
                FileEntry entry;
                std::wstring wname(record->FileName, record->FileNameLength / sizeof(wchar_t));
                entry.name = wstringToU16(wname);
                entry.attributes = record->FileAttributes;
                entry.isDirectory = (record->FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
                entry.modified = ((uint64_t)record->TimeStamp.QuadPart);
                
                changes.push_back(entry);
                
                record = (PUSN_RECORD_V2)((uint8_t*)record + record->RecordLength);
            }
            
            readData.StartUsn = nextUsn;
        }
        
        CloseHandle(hVolume);
        
        Napi::Array result = Napi::Array::New(env, changes.size());
        for (size_t i = 0; i < changes.size(); i++) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("name", Napi::String::New(env, changes[i].name));
            obj.Set("isDirectory", Napi::Boolean::New(env, changes[i].isDirectory));
            obj.Set("attributes", Napi::Number::New(env, changes[i].attributes));
            obj.Set("modified", Napi::Number::New(env, (double)changes[i].modified));
            result.Set(i, obj);
        }
        
        return result;
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    FileIndexer* indexer = new FileIndexer();
    
    exports.Set("isAdminMode", Napi::Function::New(env, 
        [indexer](const Napi::CallbackInfo& info) { return indexer->isAdminMode(info); }));
    exports.Set("getVolumes", Napi::Function::New(env,
        [indexer](const Napi::CallbackInfo& info) { return indexer->getVolumes(info); }));
    exports.Set("indexDirectory", Napi::Function::New(env,
        [indexer](const Napi::CallbackInfo& info) { return indexer->indexDirectory(info); }));
    exports.Set("readUSNJournal", Napi::Function::New(env,
        [indexer](const Napi::CallbackInfo& info) { return indexer->readUSNJournal(info); }));
    exports.Set("clearCache", Napi::Function::New(env,
        [indexer](const Napi::CallbackInfo& info) { 
            indexer->clearIndex();
            return Napi::Value();
        }));
    
    return exports;
}

NODE_API_MODULE(filehub_addon, Init)
