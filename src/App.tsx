import { useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import {
  Button,
  DatePicker,
  Descriptions,
  Form,
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

import {
  LOG_LEVELS,
  type AppListItem,
  type LogLevel,
  type LogListResponse,
  type LogQuery,
  type LogRecord,
  type VersionListItem,
} from '../shared/log';
import { formatLogTime, parseLogTime } from '../shared/logTime';

const { Content, Header } = Layout;
const { RangePicker } = DatePicker;
const levelOptions = LOG_LEVELS.map((level) => ({ label: level.toUpperCase(), value: level }));
const DEFAULT_QUERY: LogQuery = { maxFieldLength: 300 };

type QueryFormValues = {
  appName?: string;
  version?: string;
  level?: LogLevel;
  range?: [Dayjs, Dayjs];
  maxFieldLength?: number;
};

const buildQueryString = (query: LogQuery) => {
  const params = new URLSearchParams();

  if (query.appName) {
    params.set('appName', query.appName);
  }
  if (query.version) {
    params.set('version', query.version);
  }
  if (query.level) {
    params.set('level', query.level);
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.maxFieldLength !== undefined) {
    params.set('maxFieldLength', `${query.maxFieldLength}`);
  }

  return params.toString();
};

const toQuery = (values: QueryFormValues): LogQuery => ({
  appName: values.appName?.trim() || undefined,
  version: values.version?.trim() || undefined,
  level: values.level,
  from: values.range?.[0] ? formatLogTime(values.range[0]) : undefined,
  to: values.range?.[1] ? formatLogTime(values.range[1]) : undefined,
  maxFieldLength: values.maxFieldLength ?? 300,
});

const fetchLogs = async (query: LogQuery) => {
  const queryString = buildQueryString(query);
  const response = await fetch(`/api/logs${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`load_failed:${response.status}`);
  }

  return (await response.json()) as LogListResponse;
};

const deleteOne = async (id: string) => {
  const response = await fetch(`/api/logs/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`delete_failed:${response.status}`);
  }
};

const deleteMany = async (query: LogQuery) => {
  const queryString = buildQueryString(query);
  const response = await fetch(`/api/logs${queryString ? `?${queryString}` : ''}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`delete_failed:${response.status}`);
  }

  return (await response.json()) as { deleted: number };
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

const LogTable: FC<{
  header?: ReactNode;
  loading: boolean;
  logs: LogRecord[];
  onDelete: (id: string) => Promise<void>;
}> = ({ header, loading, logs, onDelete }) => (
  <Table<LogRecord>
    rowKey="id"
    loading={loading}
    dataSource={[...logs].sort((left, right) => parseLogTime(right.timestamp) - parseLogTime(left.timestamp))}
    title={header ? () => header : undefined}
    pagination={{ pageSize: 100, showSizeChanger: false }}
    columns={[
      {
        title: '应用',
        dataIndex: 'appName',
        width: 180,
      },
      {
        title: '版本',
        dataIndex: 'version',
        width: 180,
        render: (value?: string) => value || '-',
      },
      {
        title: '时间',
        dataIndex: 'timestamp',
        render: (value: string) => value,
        sorter: (left: LogRecord, right: LogRecord) => parseLogTime(left.timestamp) - parseLogTime(right.timestamp),
        defaultSortOrder: 'descend',
        width: 180,
      },
      {
        title: '级别',
        dataIndex: 'level',
        width: 100,
        render: (value: LogLevel) => <Tag color={levelColor(value)}>{value.toUpperCase()}</Tag>,
      },
      {
        title: '摘要',
        dataIndex: 'message',
      },
      {
        title: '操作',
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
          <Descriptions.Item label="应用">{record.appName}</Descriptions.Item>
          <Descriptions.Item label="版本">{record.version || '-'}</Descriptions.Item>
          <Descriptions.Item label="详细">{record.details || '-'}</Descriptions.Item>
          <Descriptions.Item label="ID">{record.id}</Descriptions.Item>
        </Descriptions>
      ),
    }}
  />
);

export const App: FC = () => {
  const [messageApi, messageContext] = message.useMessage();
  const [form] = Form.useForm<QueryFormValues>();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<LogQuery>(DEFAULT_QUERY);
  const [data, setData] = useState<LogListResponse>({ apps: [], versions: [], logs: [], total: 0 });
  const [appOptions, setAppOptions] = useState<AppListItem[]>([]);
  const [versionOptions, setVersionOptions] = useState<VersionListItem[]>([]);
  const latestLoadIdRef = useRef(0);

  const load = async (nextQuery: LogQuery) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;
    setLoading(true);

    try {
      const logs = await fetchLogs(nextQuery);
      if (loadId !== latestLoadIdRef.current) {
        return;
      }
      setData(logs);
      setAppOptions(logs.apps);
      setVersionOptions(logs.versions);
      setQuery(nextQuery);
    } catch (error) {
      if (loadId === latestLoadIdRef.current) {
        messageApi.error(error instanceof Error ? error.message : 'load_failed');
      }
    } finally {
      if (loadId === latestLoadIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load(DEFAULT_QUERY);
  }, []);

  const handleSearch = (values: QueryFormValues) => {
    void load(toQuery(values));
  };

  const handleReset = () => {
    form.resetFields();
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await deleteOne(id);
      messageApi.success('已删除');
      await load(query);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'delete_failed');
    }
  };

  const handleDeleteMany = async () => {
    try {
      const result = await deleteMany(query);
      messageApi.success(`已删 ${result.deleted} 条`);
      await load(query);
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
            logs={data.logs}
            onDelete={handleDeleteOne}
            header={
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Typography.Text>日志 {data.total} 条</Typography.Text>
                <Form form={form} initialValues={DEFAULT_QUERY} layout="inline" onFinish={handleSearch}>
                  <Space wrap size={12}>
                    <Form.Item label="应用名" name="appName">
                      <Select
                        allowClear
                        showSearch
                        placeholder="选择应用"
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        options={appOptions.map((item) => ({
                          label: `${item.appName} (${item.count})`,
                          value: item.appName,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item label="版本" name="version">
                      <Select
                        allowClear
                        showSearch
                        placeholder="选择版本"
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        options={versionOptions.map((item) => ({
                          label: `${item.version} (${item.count})`,
                          value: item.version,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item label="级别" name="level">
                      <Select allowClear options={levelOptions} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item label="时间范围" name="range">
                      <RangePicker showTime />
                    </Form.Item>
                    <Form.Item label="字段长" name="maxFieldLength">
                      <InputNumber min={0} placeholder="300" style={{ width: 120 }} />
                    </Form.Item>
                    <Button htmlType="submit" type="primary">
                      查询
                    </Button>
                    <Button onClick={handleReset}>重置</Button>
                    <Popconfirm title={`删除当前表格中的全部结果？共 ${data.total} 条`} onConfirm={() => void handleDeleteMany()}>
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
