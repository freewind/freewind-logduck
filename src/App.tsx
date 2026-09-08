import { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import {
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Layout,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';

import { LOG_LEVELS, type LogLevel, type LogRecord } from '../shared/log';
import { todayLogDate } from '../shared/logTime';

const { Content, Header } = Layout;
const { RangePicker } = DatePicker;

const NONE_VERSION = '__none__';

type QueryFormValues = {
  appName?: string;
  version?: string;
  date?: string;
  messageKeyword?: string;
  detailsKeyword?: string;
  level?: LogLevel;
  range?: [Dayjs, Dayjs];
  maxFieldLength?: number;
};

const buildQueryString = (values: QueryFormValues) => {
  const params = new URLSearchParams();

  if (values.appName) {
    params.set('appName', values.appName);
  }
  if (values.version) {
    params.set('version', values.version);
  }
  if (values.date) {
    params.set('date', values.date);
  }
  if (values.messageKeyword?.trim()) {
    params.set('messageKeyword', values.messageKeyword.trim());
  }
  if (values.detailsKeyword?.trim()) {
    params.set('detailsKeyword', values.detailsKeyword.trim());
  }
  if (values.level) {
    params.set('level', values.level);
  }
  if (values.range?.[0]) {
    params.set('from', values.range[0].format('YYYYMMDD-HHmmss'));
  }
  if (values.range?.[1]) {
    params.set('to', values.range[1].format('YYYYMMDD-HHmmss'));
  }
  params.set('maxFieldLength', `${values.maxFieldLength ?? 300}`);

  return params.toString();
};

const levelColor = (level: LogLevel) => {
  if (level === 'error') {
    return 'red';
  }
  if (level === 'warn') {
    return 'orange';
  }
  if (level === 'info') {
    return 'blue';
  }
  return 'default';
};

const versionLabel = (version: string) => (version === NONE_VERSION ? '(无版本)' : version);

const LogTable: FC<{
  header?: ReactNode;
  loading: boolean;
  logs: LogRecord[];
  onDelete: (id: string) => Promise<void>;
}> = ({ header, loading, logs, onDelete }) => (
  <Table<LogRecord>
    rowKey="id"
    loading={loading}
    dataSource={logs}
    title={header ? () => header : undefined}
    pagination={false}
    columns={[
      {
        title: 'version',
        dataIndex: 'version',
        width: 120,
        render: (value?: number) => value ?? '-',
      },
      {
        title: 'timestamp',
        dataIndex: 'timestamp',
        width: 180,
      },
      {
        title: 'level',
        dataIndex: 'level',
        width: 100,
        render: (value: LogLevel) => <Tag color={levelColor(value)}>{value.toUpperCase()}</Tag>,
      },
      {
        title: 'message',
        dataIndex: 'message',
      },
      {
        title: 'action',
        key: 'action',
        width: 100,
        render: (_, record) => (
          <Popconfirm title="删除这条日志？" onConfirm={() => onDelete(record.id)}>
            <Button danger type="link">
              删除
            </Button>
          </Popconfirm>
        ),
      },
    ]}
    expandable={{
      expandedRowRender: (record) => (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="appName">{record.appName}</Descriptions.Item>
          <Descriptions.Item label="version">{record.version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="details">{record.details || '-'}</Descriptions.Item>
          <Descriptions.Item label="id">{record.id}</Descriptions.Item>
        </Descriptions>
      ),
    }}
  />
);

export const App: FC = () => {
  const [messageApi, messageContext] = message.useMessage();
  const [form] = Form.useForm<QueryFormValues>();
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<string[]>([]);
  const [versions, setVersions] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const latestLoadIdRef = useRef(0);

  const selectedAppName = Form.useWatch('appName', form);

  const dateOptions = dates.includes(todayLogDate()) ? dates : [todayLogDate(), ...dates];

  const loadLogs = useCallback(
    async (values: QueryFormValues) => {
      if (!values.appName || !values.version) {
        setLogs([]);
        setTotal(0);
        return;
      }

      const loadId = latestLoadIdRef.current + 1;
      latestLoadIdRef.current = loadId;
      setLoading(true);

      try {
        const response = await fetch(`/api/logs?${buildQueryString(values)}`);
        if (!response.ok) {
          throw new Error(`load_failed:${response.status}`);
        }
        const data = (await response.json()) as { logs: LogRecord[]; total: number };
        if (loadId !== latestLoadIdRef.current) {
          return;
        }
        setLogs(data.logs);
        setTotal(data.total);
      } catch (error) {
        if (loadId === latestLoadIdRef.current) {
          messageApi.error(error instanceof Error ? error.message : 'load_failed');
        }
      } finally {
        if (loadId === latestLoadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [messageApi],
  );

  const loadVersions = useCallback(async (appName: string) => {
    const response = await fetch(`/api/versions?appName=${encodeURIComponent(appName)}`);
    if (!response.ok) {
      setVersions([]);
      return;
    }
    const data = (await response.json()) as { versions: string[] };
    setVersions(data.versions);
  }, []);

  const loadDates = useCallback(async (appName: string, version: string) => {
    const response = await fetch(
      `/api/dates?appName=${encodeURIComponent(appName)}&version=${encodeURIComponent(version)}`,
    );
    if (!response.ok) {
      setDates([]);
      return;
    }
    const data = (await response.json()) as { dates: string[] };
    setDates(data.dates);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/apps');
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { apps: string[] };
        setApps(data.apps);
      } catch {
        setApps([]);
      }
    })();
  }, []);

  const handleAppChange = async (appName?: string) => {
    setVersions([]);
    setDates([]);
    setLogs([]);
    setTotal(0);
    form.setFieldsValue({ version: undefined, date: undefined });

    if (appName) {
      await loadVersions(appName);
    }
  };

  const handleVersionChange = async (version?: string) => {
    setDates([]);
    setLogs([]);
    setTotal(0);
    form.setFieldValue('date', undefined);

    if (selectedAppName && version) {
      await loadDates(selectedAppName, version);
      const date = todayLogDate();
      form.setFieldValue('date', date);
      void loadLogs({ ...(form.getFieldsValue() as QueryFormValues), date });
    }
  };

  const handleSearch = (values: QueryFormValues) => {
    void loadLogs(values);
  };

  const handleDeleteOne = async (id: string) => {
    try {
      const response = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`delete_failed:${response.status}`);
      }
      messageApi.success('已删除');
      await loadLogs(form.getFieldsValue() as QueryFormValues);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'delete_failed');
    }
  };

  const handleDeleteMany = async () => {
    const values = form.getFieldsValue() as QueryFormValues;
    try {
      const response = await fetch(`/api/logs?${buildQueryString(values)}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`delete_failed:${response.status}`);
      }
      const result = (await response.json()) as { deleted: number };
      messageApi.success(`已删 ${result.deleted} 条`);
      await loadLogs(values);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'delete_failed');
    }
  };

  return (
    <>
      {messageContext}
      <Layout>
        <Header>
          <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>
            Log Dog
          </Typography.Title>
        </Header>
        <Content style={{ padding: 24 }}>
          <LogTable
            loading={loading}
            logs={logs}
            onDelete={handleDeleteOne}
            header={
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Typography.Text>total {total}</Typography.Text>
                <Form form={form} layout="inline" onFinish={handleSearch}>
                  <Space wrap size={12}>
                    <Form.Item label="appName" name="appName">
                      <Select
                        allowClear
                        showSearch
                        placeholder="appName"
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        onChange={(value) => void handleAppChange(value)}
                        options={apps.map((appName) => ({ label: appName, value: appName }))}
                      />
                    </Form.Item>
                    <Form.Item label="version" name="version">
                      <Select
                        allowClear
                        showSearch
                        placeholder="version"
                        optionFilterProp="label"
                        style={{ width: 180 }}
                        onChange={(value) => void handleVersionChange(value)}
                        options={versions.map((version) => ({ label: versionLabel(version), value: version }))}
                      />
                    </Form.Item>
                    <Form.Item label="date" name="date">
                      <Select
                        allowClear
                        placeholder="date"
                        style={{ width: 160 }}
                        onChange={(value) => void loadLogs(form.getFieldsValue() as QueryFormValues)}
                        options={dateOptions.map((date) => ({ label: date, value: date }))}
                      />
                    </Form.Item>
                    <Form.Item label="messageKeyword" name="messageKeyword">
                      <Input placeholder="message keyword" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item label="detailsKeyword" name="detailsKeyword">
                      <Input placeholder="details keyword" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item label="level" name="level">
                      <Select
                        allowClear
                        placeholder="level"
                        style={{ width: 120 }}
                        options={LOG_LEVELS.map((level) => ({ label: level.toUpperCase(), value: level }))}
                      />
                    </Form.Item>
                    <Form.Item label="range" name="range">
                      <RangePicker showTime />
                    </Form.Item>
                    <Form.Item label="maxFieldLength" name="maxFieldLength">
                      <InputNumber min={0} placeholder="300" style={{ width: 120 }} />
                    </Form.Item>
                    <Button htmlType="submit" type="primary">
                      查询
                    </Button>
                    <Button onClick={() => form.resetFields()}>重置</Button>
                    <Popconfirm title={`删除当前文件内匹配结果？共 ${total} 条`} onConfirm={() => void handleDeleteMany()}>
                      <Button danger>删除筛选结果</Button>
                    </Popconfirm>
                  </Space>
                </Form>
              </Space>
            }
          />
        </Content>
      </Layout>
    </>
  );
};
