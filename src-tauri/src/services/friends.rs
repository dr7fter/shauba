// 好友影子对决：WebDAV（坚果云）快照同步域——test / publish / pull 三个命令
// 与其协议辅助函数。纯网络协议逻辑，不持有也不引用 AppState / DB 连接；
// lib.rs 仅经 command 注册表与 sanitize_friend_sync_code（用户资料页校验好友码）
// 依赖本模块。quick_xml 解析在函数内局部 import。
use rand::Rng;
use reqwest::{blocking::Client, Method, StatusCode, Url};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendSyncConfig {
    pub endpoint: String,
    pub username: String,
    pub app_password: String,
    pub folder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendSyncRemoteSnapshot {
    pub file_name: String,
    pub payload: String,
    #[serde(default)]
    pub server_etag: Option<String>,
    #[serde(default)]
    pub unchanged: bool,
}

pub(crate) fn sanitize_friend_sync_code(value: &str) -> Result<String, String> {
    let code = value.trim().to_uppercase();
    if code.len() < 2
        || code.len() > 64
        || !code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("好友码包含不安全字符".to_string());
    }
    Ok(code)
}

fn friend_sync_file_name(friend_code: &str) -> Result<String, String> {
    Ok(format!(
        "shuaba-friend-{}.json",
        sanitize_friend_sync_code(friend_code)?
    ))
}

fn friend_sync_base_url(config: &FriendSyncConfig) -> Result<Url, String> {
    let endpoint = config.endpoint.trim();
    if endpoint.is_empty() {
        return Err("请填写坚果云 WebDAV 地址".to_string());
    }
    if config.username.trim().is_empty() || config.app_password.trim().is_empty() {
        return Err("请填写坚果云账号和应用密码".to_string());
    }
    let mut url = Url::parse(endpoint).map_err(|_| "WebDAV 地址格式不正确".to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("WebDAV 地址必须使用 http 或 https".to_string());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("WebDAV 地址不能包含查询参数或片段（请删除 ?... 或 #...）".to_string());
    }
    let mut path = url.path().trim_end_matches('/').to_string();
    if path.is_empty() {
        path.push('/');
    } else {
        path.push('/');
    }
    url.set_path(&path);
    Ok(url)
}

fn friend_sync_folder_url(config: &FriendSyncConfig) -> Result<Url, String> {
    let mut url = friend_sync_base_url(config)?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "WebDAV 地址不可用于路径拼接".to_string())?;
        for segment in config
            .folder
            .trim_matches('/')
            .split('/')
            .filter(|s| !s.is_empty())
        {
            if segment == "."
                || segment == ".."
                || segment.contains('\\')
                || segment.contains(':')
                || segment.contains('?')
                || segment.contains('#')
            {
                return Err("共享文件夹路径只能填写坚果云里的文件夹名，例如 shuaba-friends；不要填写 E:\\... 这样的电脑本地路径或完整网址".to_string());
            }
            segments.push(segment);
        }
    }
    if !url.path().ends_with('/') {
        let mut path = url.path().to_string();
        path.push('/');
        url.set_path(&path);
    }
    Ok(url)
}

fn friend_sync_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(4))
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Shuaba-Friends/1")
        .build()
        .map_err(|e| format!("创建同步连接失败：{e}"))
}

fn friend_sync_auth(
    request: reqwest::blocking::RequestBuilder,
    config: &FriendSyncConfig,
) -> reqwest::blocking::RequestBuilder {
    request.basic_auth(config.username.trim(), Some(config.app_password.trim()))
}

fn friend_sync_status_error(action: &str, status: StatusCode) -> String {
    match status {
        StatusCode::UNAUTHORIZED => format!("{action}失败：HTTP 401。请检查坚果云账号和应用密码（不是网页登录密码）"),
        StatusCode::FORBIDDEN => format!("{action}失败：HTTP 403。当前账号没有该共享文件夹的读写权限"),
        StatusCode::NOT_FOUND => format!("{action}失败：HTTP 404。请检查 WebDAV 地址和共享文件夹名称"),
        StatusCode::CONFLICT => format!(
            "{action}失败：HTTP 409。请确认目标云端文件夹已创建、名称和层级完全一致，并且当前账号有权限访问"
        ),
        StatusCode::METHOD_NOT_ALLOWED => format!("{action}失败：HTTP 405。坚果云拒绝了当前 WebDAV 操作"),
        status if status.is_server_error() => format!("{action}失败：HTTP {status}。坚果云服务或网络暂时异常，请稍后重试"),
        _ => format!("{action}失败：HTTP {status}。请检查坚果云配置和共享目录权限"),
    }
}

fn friend_sync_propfind_with_depth(
    client: &Client,
    url: Url,
    config: &FriendSyncConfig,
    depth: &str,
) -> Result<reqwest::blocking::Response, String> {
    // 显式发送标准 PROPFIND XML，兼容坚果云对空请求体的处理差异。
    const PROPFIND_BODY: &str =
        r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><allprop/></propfind>"#;
    friend_sync_auth(
        client.request(Method::from_bytes(b"PROPFIND").unwrap(), url),
        config,
    )
    .header("Depth", depth)
    .header("Content-Type", "application/xml; charset=utf-8")
    .body(PROPFIND_BODY)
    .send()
    .map_err(|e| format!("连接坚果云失败：{e}"))
}

fn friend_sync_propfind(
    client: &Client,
    url: Url,
    config: &FriendSyncConfig,
) -> Result<reqwest::blocking::Response, String> {
    friend_sync_propfind_with_depth(client, url, config, "0")
}

fn friend_sync_folder_url_without_trailing_slash(url: &Url) -> Url {
    let mut candidate = url.clone();
    let path = candidate.path().trim_end_matches('/').to_string();
    candidate.set_path(&path);
    candidate
}

fn friend_sync_href_values(xml: &str) -> Result<Vec<String>, String> {
    use quick_xml::{escape::unescape, events::Event, Reader};

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut values = Vec::new();
    let mut in_href = false;
    let mut current = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(event))
                if event.local_name().as_ref().eq_ignore_ascii_case(b"href") =>
            {
                in_href = true;
                current.clear();
            }
            Ok(Event::Text(event)) if in_href => {
                let text = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                current.push_str(&text);
            }
            Ok(Event::CData(event)) if in_href => {
                current.push_str(&String::from_utf8_lossy(event.as_ref()));
            }
            Ok(Event::GeneralRef(event)) if in_href => {
                let reference = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                let escaped = format!("&{reference};");
                let text = unescape(&escaped).map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                current.push_str(&text);
            }
            Ok(Event::End(event))
                if in_href && event.local_name().as_ref().eq_ignore_ascii_case(b"href") =>
            {
                let value = current.trim();
                if !value.is_empty() {
                    values.push(value.to_string());
                }
                in_href = false;
                current.clear();
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("解析 WebDAV XML 失败：{error}")),
        }
    }

    Ok(values)
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct FriendSyncPropfindEntry {
    href: String,
    etag: Option<String>,
    last_modified: Option<String>,
    content_length: Option<u64>,
}

impl FriendSyncPropfindEntry {
    fn signature(&self) -> String {
        if let Some(ref etag) = self.etag {
            let trimmed = etag.trim().trim_matches('"');
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        format!(
            "{}:{}",
            self.last_modified.as_deref().unwrap_or(""),
            self.content_length.unwrap_or(0)
        )
    }
}

fn friend_sync_propfind_entries(xml: &str) -> Result<Vec<FriendSyncPropfindEntry>, String> {
    use quick_xml::{escape::unescape, events::Event, Reader};

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut entries = Vec::new();
    let mut current_entry = FriendSyncPropfindEntry::default();
    let mut in_response = false;
    let mut current_tag = Vec::<u8>::new();
    let mut current_text = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref event)) => {
                let name = event.local_name();
                let lower = name.as_ref();
                if lower.eq_ignore_ascii_case(b"response") {
                    in_response = true;
                    current_entry = FriendSyncPropfindEntry::default();
                } else if in_response {
                    current_tag = lower.to_vec();
                    current_text.clear();
                }
            }
            Ok(Event::Text(ref event)) if in_response && !current_tag.is_empty() => {
                let text = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV XML 文本失败：{e}"))?;
                current_text.push_str(&text);
            }
            Ok(Event::CData(ref event)) if in_response && !current_tag.is_empty() => {
                current_text.push_str(&String::from_utf8_lossy(event.as_ref()));
            }
            Ok(Event::GeneralRef(ref event)) if in_response && !current_tag.is_empty() => {
                let reference = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV XML 引用失败：{e}"))?;
                let escaped = format!("&{reference};");
                let text = unescape(&escaped).map_err(|e| format!("解析 WebDAV XML 失败：{e}"))?;
                current_text.push_str(&text);
            }
            Ok(Event::End(ref event)) => {
                let name = event.local_name();
                let lower = name.as_ref();
                if lower.eq_ignore_ascii_case(b"response") {
                    if !current_entry.href.is_empty() {
                        entries.push(std::mem::take(&mut current_entry));
                    }
                    in_response = false;
                    current_tag.clear();
                    current_text.clear();
                } else if in_response && lower.eq_ignore_ascii_case(&current_tag) {
                    let val = current_text.trim();
                    if lower.eq_ignore_ascii_case(b"href") {
                        current_entry.href = val.to_string();
                    } else if lower.eq_ignore_ascii_case(b"getetag") {
                        let etag_clean = val.trim_matches('"').to_string();
                        if !etag_clean.is_empty() {
                            current_entry.etag = Some(etag_clean);
                        }
                    } else if lower.eq_ignore_ascii_case(b"getlastmodified") {
                        if !val.is_empty() {
                            current_entry.last_modified = Some(val.to_string());
                        }
                    } else if lower.eq_ignore_ascii_case(b"getcontentlength") {
                        if let Ok(len) = val.parse::<u64>() {
                            current_entry.content_length = Some(len);
                        }
                    }
                    current_tag.clear();
                    current_text.clear();
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("解析 WebDAV XML 失败：{error}")),
        }
    }

    Ok(entries)
}

fn friend_sync_decode_path_segment(value: &str) -> Option<String> {
    percent_encoding::percent_decode_str(value)
        .decode_utf8()
        .ok()
        .map(|decoded| decoded.into_owned())
}

fn friend_sync_decoded_path_segments(url: &Url) -> Option<Vec<String>> {
    let mut segments = url
        .path_segments()?
        .map(friend_sync_decode_path_segment)
        .collect::<Option<Vec<_>>>()?;
    // Url::path_segments() includes a final empty segment for a collection URL
    // ending with '/', but empty segments in the middle remain significant.
    if segments.last().is_some_and(String::is_empty) {
        segments.pop();
    }
    Some(segments)
}

fn friend_sync_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn friend_sync_href_url(base: &Url, href: &str) -> Option<Url> {
    let candidate = Url::parse(href).ok().or_else(|| base.join(href).ok())?;
    if !friend_sync_same_origin(base, &candidate)
        || candidate.query().is_some()
        || candidate.fragment().is_some()
    {
        return None;
    }
    Some(candidate)
}

fn friend_sync_discover_folder_url(
    client: &Client,
    config: &FriendSyncConfig,
) -> Result<Option<Url>, String> {
    let root = friend_sync_base_url(config)?;
    let response = friend_sync_propfind_with_depth(client, root.clone(), config, "1")?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let body = response
        .text()
        .map_err(|e| format!("读取坚果云目录失败：{e}"))?;
    let hrefs = friend_sync_href_values(&body)?;
    let root_segments = friend_sync_decoded_path_segments(&root).unwrap_or_default();
    let wanted_segments: Vec<String> = config
        .folder
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect();
    if wanted_segments.is_empty() {
        return Ok(None);
    }

    for href in hrefs {
        let Some(candidate) = friend_sync_href_url(&root, &href) else {
            continue;
        };
        let Some(candidate_segments) = friend_sync_decoded_path_segments(&candidate) else {
            continue;
        };
        let mut expected = root_segments.clone();
        expected.extend(wanted_segments.iter().cloned());
        if candidate_segments == expected {
            let mut folder = candidate;
            let mut path = folder.path().trim_end_matches('/').to_string();
            path.push('/');
            folder.set_path(&path);
            return Ok(Some(folder));
        }
    }
    Ok(None)
}

fn friend_sync_resolve_folder_url(
    client: &Client,
    config: &FriendSyncConfig,
) -> Result<Url, String> {
    Ok(friend_sync_discover_folder_url(client, config)?.unwrap_or(friend_sync_folder_url(config)?))
}

fn friend_sync_directory_diagnostic(
    client: &Client,
    config: &FriendSyncConfig,
    folder_url: &Url,
    initial_status: StatusCode,
) -> Result<String, String> {
    if initial_status.is_success() {
        return Ok("通过".to_string());
    }

    if initial_status == StatusCode::CONFLICT {
        let without_slash = friend_sync_folder_url_without_trailing_slash(folder_url);
        let fallback = friend_sync_propfind(client, without_slash, config)?;
        if fallback.status().is_success() {
            return Ok("通过（兼容目录末尾斜杠）".to_string());
        }
        if let Some(discovered) = friend_sync_discover_folder_url(client, config)? {
            if discovered == *folder_url {
                return Ok(
                    "已识别（目录 PROPFIND 返回 409，已通过实际文件读写继续验证）".to_string(),
                );
            }
        }
        let root_response = friend_sync_propfind(client, friend_sync_base_url(config)?, config)?;
        if root_response.status().is_success() {
            return Err("坚果云账号可用，但 WebDAV 根目录中找不到目标文件夹。请确认文件夹名称、层级和共享权限".to_string());
        }
        return Ok("未能读取目录（PROPFIND 409，已通过实际文件读写继续验证）".to_string());
    }

    if initial_status == StatusCode::NOT_FOUND {
        let root_response = friend_sync_propfind(client, friend_sync_base_url(config)?, config)?;
        if root_response.status().is_success()
            && friend_sync_discover_folder_url(client, config)?.is_none()
        {
            return Err("坚果云账号可用，但 WebDAV 根目录中找不到目标文件夹。请确认文件夹名称、层级和共享权限".to_string());
        }
    }

    Err(friend_sync_status_error("访问共享文件夹", initial_status))
}

fn friend_sync_delete_probe(
    client: &Client,
    config: &FriendSyncConfig,
    probe_url: &Url,
) -> Result<(), String> {
    let response = friend_sync_auth(
        client.request(
            Method::from_bytes(b"DELETE").expect("DELETE is a valid HTTP method"),
            probe_url.clone(),
        ),
        config,
    )
    .send()
    .map_err(|e| format!("删除测试探针失败：{e}"))?;
    if response.status().is_success() || response.status() == StatusCode::NOT_FOUND {
        Ok(())
    } else {
        Err(friend_sync_status_error("删除测试探针", response.status()))
    }
}

fn friend_sync_probe_put(
    client: &Client,
    config: &FriendSyncConfig,
    folder_url: &Url,
    file_url: &Url,
    payload: &str,
) -> Result<(), String> {
    let send_put = |url: Url, body: String| {
        friend_sync_auth(client.put(url), config)
            .header("Content-Type", "application/json; charset=utf-8")
            .body(body)
            .send()
    };

    let response = match send_put(file_url.clone(), payload.to_string()) {
        Ok(response) => response,
        Err(error) => {
            // PUT 可能在服务端已经落盘后才因超时/连接中断返回错误，
            // 因此失败也必须尽量删除随机探针，避免云端残留临时文件。
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("测试探针上传请求失败后的清理也失败：{cleanup_error}");
            }
            return Err(format!("上传测试探针失败：{error}（已尝试清理测试探针）"));
        }
    };
    if response.status().is_success() {
        return Ok(());
    }

    if response.status() != StatusCode::NOT_FOUND && response.status() != StatusCode::CONFLICT {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("测试探针上传失败后的清理也失败：{cleanup_error}");
        }
        return Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("上传测试探针", response.status())
        ));
    }

    let mkcol = match friend_sync_auth(
        client.request(
            Method::from_bytes(b"MKCOL").expect("MKCOL is a valid HTTP method"),
            folder_url.clone(),
        ),
        config,
    )
    .send()
    {
        Ok(response) => response,
        Err(error) => {
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("创建共享目录请求失败后的测试探针清理也失败：{cleanup_error}");
            }
            return Err(format!("创建共享目录失败：{error}（已尝试清理测试探针）"));
        }
    };
    if !(mkcol.status().is_success()
        || mkcol.status() == StatusCode::METHOD_NOT_ALLOWED
        || mkcol.status() == StatusCode::CONFLICT)
    {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("创建共享目录失败后的测试探针清理也失败：{cleanup_error}");
        }
        return Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("创建共享目录", mkcol.status())
        ));
    }

    let retry = match send_put(file_url.clone(), payload.to_string()) {
        Ok(response) => response,
        Err(error) => {
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("重试上传请求失败后的测试探针清理也失败：{cleanup_error}");
            }
            return Err(format!(
                "重试上传测试探针失败：{error}（已尝试清理测试探针）"
            ));
        }
    };
    if retry.status().is_success() {
        Ok(())
    } else {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("重试上传失败后的测试探针清理也失败：{cleanup_error}");
        }
        Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("上传测试探针", retry.status())
        ))
    }
}

fn friend_sync_payload_from_response(
    response: reqwest::blocking::Response,
    action: &str,
) -> Result<String, String> {
    const MAX_PAYLOAD_BYTES: usize = 256 * 1024;
    if let Some(length) = response.content_length() {
        if length > MAX_PAYLOAD_BYTES as u64 {
            return Err(format!("{action}失败：好友数据超过 256 KB 大小限制"));
        }
    }
    let bytes = response
        .bytes()
        .map_err(|e| format!("{action}失败：读取响应失败：{e}"))?;
    if bytes.len() > MAX_PAYLOAD_BYTES {
        return Err(format!("{action}失败：好友数据超过 256 KB 大小限制"));
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| format!("{action}失败：响应不是有效 UTF-8 JSON"))
}

fn test_friend_sync_impl(config: FriendSyncConfig) -> Result<String, String> {
    let client = friend_sync_client()?;

    let root_response = friend_sync_propfind(&client, friend_sync_base_url(&config)?, &config)?;
    let auth_status = root_response.status();
    if auth_status == StatusCode::UNAUTHORIZED || auth_status == StatusCode::FORBIDDEN {
        return Err(friend_sync_status_error("账号认证", auth_status));
    }
    if !auth_status.is_success() && auth_status != StatusCode::CONFLICT {
        return Err(friend_sync_status_error(
            "账号认证/访问 WebDAV 根目录",
            auth_status,
        ));
    }
    let auth_label = if auth_status.is_success() {
        "通过"
    } else {
        "通过（根目录 PROPFIND 返回 409，继续用实际读写验证）"
    };
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;

    let directory_response = friend_sync_propfind(&client, folder_url.clone(), &config)?;
    let directory_label = friend_sync_directory_diagnostic(
        &client,
        &config,
        &folder_url,
        directory_response.status(),
    )?;

    let probe_name = format!(
        ".shuaba-connection-test-{:016x}.tmp",
        rand::rng().random::<u64>()
    );
    let probe_url = folder_url
        .join(&probe_name)
        .map_err(|_| "无法拼接坚果云测试探针路径".to_string())?;
    let probe_payload = format!(r#"{{"probe":"shuaba","id":"{}"}}"#, probe_name);

    let write_result =
        friend_sync_probe_put(&client, &config, &folder_url, &probe_url, &probe_payload);
    if let Err(error) = write_result {
        return Err(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；写入：失败。{error}"
        ));
    }

    let read_result = match friend_sync_auth(client.get(probe_url.clone()), &config).send() {
        Ok(response) if response.status().is_success() => {
            match friend_sync_payload_from_response(response, "读取测试探针") {
                Ok(payload) if payload == probe_payload => Ok(()),
                Ok(_) => Err("读取测试探针失败：返回内容与上传内容不一致".to_string()),
                Err(error) => Err(error),
            }
        }
        Ok(response) => Err(friend_sync_status_error("读取测试探针", response.status())),
        Err(error) => Err(format!("读取测试探针失败：{error}")),
    };

    let delete_result = friend_sync_delete_probe(&client, &config, &probe_url);

    if let Err(error) = read_result {
        if let Err(delete_error) = delete_result {
            log::warn!("测试探针读取失败后的清理也失败：{delete_error}");
        }
        return Err(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；写入：通过；读取：失败。{error}（测试探针已尝试清理）"
        ));
    }

    match delete_result {
        Ok(()) => Ok(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；读取：通过；写入：通过；删除：通过。坚果云实际读写权限正常"
        )),
        Err(error) => Ok(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；读取：通过；写入：通过；删除：失败。{error}；同步仍可用，但共享目录可能无法清理临时文件"
        )),
    }
}

// 好友同步全部走阻塞式 HTTP 客户端。若直接以同步命令形式执行，会占用 Tauri 主线程并冻结
// WebView（表现为主界面周期性卡顿）。这里统一用 async 命令 + spawn_blocking 把网络 I/O
// 转移到专用阻塞线程池，主线程只负责接收结果，全程不阻塞渲染。
#[tauri::command]
pub(crate) async fn test_friend_sync(config: FriendSyncConfig) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || test_friend_sync_impl(config))
        .await
        .map_err(|e| format!("好友同步后台任务异常退出：{e}"))?
}

fn publish_friend_snapshot_impl(
    config: FriendSyncConfig,
    friend_code: String,
    payload: String,
) -> Result<String, String> {
    const MAX_PAYLOAD_BYTES: usize = 256 * 1024;
    if payload.len() > MAX_PAYLOAD_BYTES {
        return Err("上传好友数据失败：好友数据超过 256 KB 大小限制".to_string());
    }
    let client = friend_sync_client()?;
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;
    let file_name = friend_sync_file_name(&friend_code)?;
    let file_url = folder_url
        .join(&file_name)
        .map_err(|_| "无法拼接好友数据文件路径".to_string())?;
    let response = friend_sync_auth(client.put(file_url.clone()), &config)
        .header("Content-Type", "application/json; charset=utf-8")
        .body(payload.clone())
        .send()
        .map_err(|e| format!("上传好友数据失败：{e}"))?;
    if response.status().is_success() {
        return Ok(file_name);
    }

    if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::CONFLICT {
        let mkcol = friend_sync_auth(
            client.request(
                Method::from_bytes(b"MKCOL").expect("MKCOL is a valid HTTP method"),
                folder_url.clone(),
            ),
            &config,
        )
        .send()
        .map_err(|e| format!("创建共享目录失败：{e}"))?;
        if !(mkcol.status().is_success()
            || mkcol.status() == StatusCode::METHOD_NOT_ALLOWED
            || mkcol.status() == StatusCode::CONFLICT)
        {
            return Err(friend_sync_status_error("创建共享目录", mkcol.status()));
        }

        let retry = friend_sync_auth(client.put(file_url), &config)
            .header("Content-Type", "application/json; charset=utf-8")
            .body(payload)
            .send()
            .map_err(|e| format!("重试上传好友数据失败：{e}"))?;
        if retry.status().is_success() {
            Ok(file_name)
        } else {
            Err(friend_sync_status_error("上传好友数据", retry.status()))
        }
    } else {
        Err(friend_sync_status_error("上传好友数据", response.status()))
    }
}

#[tauri::command]
pub(crate) async fn publish_friend_snapshot(
    config: FriendSyncConfig,
    friend_code: String,
    payload: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        publish_friend_snapshot_impl(config, friend_code, payload)
    })
    .await
    .map_err(|e| format!("好友数据上传后台任务异常退出：{e}"))?
}

fn friend_sync_file_from_href(folder_url: &Url, href: &str) -> Option<(String, Url)> {
    let candidate = friend_sync_href_url(folder_url, href)?;
    let folder_segments = friend_sync_decoded_path_segments(folder_url)?;
    let candidate_segments = friend_sync_decoded_path_segments(&candidate)?;
    if candidate_segments.len() != folder_segments.len() + 1
        || candidate_segments[..folder_segments.len()] != folder_segments[..]
    {
        return None;
    }

    let file_name = candidate_segments.last()?.as_str();
    let prefix = "shuaba-friend-";
    let code = file_name.strip_prefix(prefix)?.strip_suffix(".json")?;
    let normalized_code = sanitize_friend_sync_code(code).ok()?;
    let canonical_name = friend_sync_file_name(&normalized_code).ok()?;
    Some((canonical_name, candidate))
}

fn pull_friend_snapshots_impl(
    config: FriendSyncConfig,
    friend_codes: Vec<String>,
    known_hashes: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<FriendSyncRemoteSnapshot>, String> {
    let client = friend_sync_client()?;
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;
    let mut files = std::collections::BTreeMap::<String, (Url, Option<String>)>::new();
    let known = known_hashes.unwrap_or_default();

    // 自动发现只接受 XML href 指向目标共享目录的直接子文件，避免把 XML 文本中的
    // 任意片段误当成好友文件；文件名统一规范化后去重。
    match friend_sync_propfind_with_depth(&client, folder_url.clone(), &config, "1") {
        Ok(response) if response.status().is_success() => match response.text() {
            Ok(xml) => match friend_sync_propfind_entries(&xml) {
                Ok(entries) => {
                    for entry in entries {
                        if let Some((file_name, file_url)) =
                            friend_sync_file_from_href(&folder_url, &entry.href)
                        {
                            let sig = entry.signature();
                            files.entry(file_name).or_insert((file_url, Some(sig)));
                        }
                    }
                }
                Err(error) => log::warn!("好友同步自动发现失败：{error}"),
            },
            Err(error) => log::warn!("好友同步读取目录失败：{error}"),
        },
        Ok(response) => log::warn!(
            "好友同步自动发现跳过：{}",
            friend_sync_status_error("列出好友文件", response.status())
        ),
        Err(error) => log::warn!("好友同步自动发现请求失败：{error}"),
    }

    // 显式好友码是自动发现不可用时的定向兜底，也使用同一套安全规则。
    for code in friend_codes {
        match friend_sync_file_name(&code) {
            Ok(file_name) => {
                if let Ok(file_url) = folder_url.join(&file_name) {
                    files.entry(file_name).or_insert((file_url, None));
                }
            }
            Err(error) => log::warn!("跳过不安全好友码：{error}"),
        }
    }

    let mut snapshots = Vec::new();
    for (file_name, (file_url, sig)) in files {
        if let Some(ref server_sig) = sig {
            if let Some(local_sig) = known.get(&file_name) {
                if local_sig == server_sig && !server_sig.is_empty() {
                    // 远端文件签名未发生变化，命中差异缓存，跳过下载 GET 请求
                    snapshots.push(FriendSyncRemoteSnapshot {
                        file_name,
                        payload: String::new(),
                        server_etag: Some(server_sig.clone()),
                        unchanged: true,
                    });
                    continue;
                }
            }
        }

        let response = match friend_sync_auth(client.get(file_url), &config).send() {
            Ok(response) => response,
            Err(error) => {
                log::warn!("好友文件 {file_name} 下载失败：{error}");
                continue;
            }
        };
        if response.status() == StatusCode::NOT_FOUND {
            log::debug!("好友文件 {file_name} 尚未发布");
            continue;
        }
        if !response.status().is_success() {
            log::warn!(
                "好友文件 {file_name} 下载失败：{}",
                friend_sync_status_error("读取好友数据", response.status())
            );
            continue;
        }
        let etag_header = response
            .headers()
            .get("etag")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.trim_matches('"').to_string())
            .or(sig);
        match friend_sync_payload_from_response(response, "读取好友数据") {
            Ok(payload) => snapshots.push(FriendSyncRemoteSnapshot {
                file_name,
                payload,
                server_etag: etag_header,
                unchanged: false,
            }),
            Err(error) => log::warn!("好友文件 {file_name} 无法使用：{error}"),
        }
    }
    Ok(snapshots)
}

#[tauri::command]
pub(crate) async fn pull_friend_snapshots(
    config: FriendSyncConfig,
    friend_codes: Vec<String>,
    known_hashes: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<FriendSyncRemoteSnapshot>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pull_friend_snapshots_impl(config, friend_codes, known_hashes)
    })
    .await
    .map_err(|e| format!("好友数据拉取后台任务异常退出：{e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn friend_sync_code_is_normalized_and_rejects_path_characters() {
        assert_eq!(sanitize_friend_sync_code(" sb-ab_12 ").unwrap(), "SB-AB_12");
        assert!(sanitize_friend_sync_code("SB/AB").is_err());
        assert!(sanitize_friend_sync_code("SB AB").is_err());
        assert!(sanitize_friend_sync_code("A").is_err());
        assert!(sanitize_friend_sync_code(&"A".repeat(65)).is_err());
    }

    #[test]
    fn friend_sync_endpoint_rejects_query_fragment_and_unsafe_folder_segments() {
        let config = |endpoint: &str, folder: &str| FriendSyncConfig {
            endpoint: endpoint.to_string(),
            username: "user@example.com".to_string(),
            app_password: "app-password".to_string(),
            folder: folder.to_string(),
        };

        assert!(
            friend_sync_base_url(&config("https://dav.example/dav/?x=1", "shuaba-friends"))
                .is_err()
        );
        assert!(
            friend_sync_base_url(&config("https://dav.example/dav/#folder", "shuaba-friends"))
                .is_err()
        );
        assert!(friend_sync_folder_url(&config("https://dav.example/dav/", "E:\\刷吧")).is_err());
        assert!(friend_sync_folder_url(&config("https://dav.example/dav/", "../other")).is_err());
        assert!(
            friend_sync_folder_url(&config("https://dav.example/dav/", "folder?name")).is_err()
        );
        assert!(
            friend_sync_folder_url(&config("https://dav.example/dav/", "folder#name")).is_err()
        );
    }

    #[test]
    fn friend_sync_href_parser_handles_namespaces_entities_and_cdata() {
        let xml = r#"<?xml version="1.0"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response><D:href>/dav/shuaba-friends/</D:href></D:response>
              <d:response><d:href>/dav/shuaba-friends/shuaba-friend-SB&amp;A.json</d:href></d:response>
              <response><href><![CDATA[/dav/shuaba-friends/shuaba-friend-SB-B.json]]></href></response>
            </D:multistatus>"#;
        let hrefs = friend_sync_href_values(xml).unwrap();
        assert_eq!(hrefs.len(), 3);
        assert_eq!(hrefs[0], "/dav/shuaba-friends/");
        assert_eq!(hrefs[1], "/dav/shuaba-friends/shuaba-friend-SB&A.json");
        assert_eq!(hrefs[2], "/dav/shuaba-friends/shuaba-friend-SB-B.json");
        assert!(
            friend_sync_href_values("<multistatus><href>&bogus;</href></multistatus>").is_err()
        );
    }

    #[test]
    fn friend_sync_propfind_entries_parses_etag_and_last_modified() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>/dav/shuaba-friends/shuaba-friend-SB-AAA.json</D:href>
                <D:propstat>
                  <D:prop>
                    <D:getetag>"etag-12345"</D:getetag>
                    <D:getlastmodified>Tue, 25 Aug 2026 10:00:00 GMT</D:getlastmodified>
                    <D:getcontentlength>2048</D:getcontentlength>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>"#;
        let entries = friend_sync_propfind_entries(xml).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].href, "/dav/shuaba-friends/shuaba-friend-SB-AAA.json");
        assert_eq!(entries[0].etag.as_deref(), Some("etag-12345"));
        assert_eq!(entries[0].signature(), "etag-12345");
    }

    #[test]
    fn friend_sync_href_file_requires_same_origin_and_direct_child() {
        let folder = Url::parse("https://dav.example/dav/shuaba-friends/").unwrap();
        let discovered = friend_sync_file_from_href(
            &folder,
            "https://dav.example/dav/shuaba-friends/shuaba-friend-sb%2Dabc.json",
        )
        .unwrap();
        assert_eq!(discovered.0, "shuaba-friend-SB-ABC.json");
        assert_eq!(
            discovered.1.path(),
            "/dav/shuaba-friends/shuaba-friend-sb%2Dabc.json"
        );
        assert!(friend_sync_file_from_href(
            &folder,
            "https://evil.example/dav/shuaba-friends/shuaba-friend-SB-ABC.json"
        )
        .is_none());
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/nested/shuaba-friend-SB-ABC.json"
        )
        .is_none());
        assert!(
            friend_sync_file_from_href(&folder, "/dav/other/shuaba-friend-SB-ABC.json").is_none()
        );
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/shuaba-friend-SB-ABC.json?rev=1"
        )
        .is_none());
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/shuaba-friend-SB-ABC.json#fragment"
        )
        .is_none());
    }
}
