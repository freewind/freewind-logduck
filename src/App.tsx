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

import { LOG_LEVELS, type AppListItem, type LogLevel, type LogListResponse, type LogQuery, type LogRecord } from '../shared/log';
import { formatLogTime } from '../shared/logTime';

const { Content, Header } = Layout;
const { RangePicker } = DatePicker;
const levelOptions = LOG_LEVELS.map((level) => ({ label: level.toUpperCase(), value: level }));

type QueryFormValues = {
  appName?: string;
  level?: LogLevel;
  range?: [Dayjs, Dayjs];
  limit?: number;
};

const buildQueryString = (query: LogQuery) => {
  const params = new URLSearchParams();

  if (query.appName) {
    params.set('appName', query.appName);
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
  if (query.limit) {
    params.set('limit', `${query.limit}`);
  }

  return params.toString();
};

const toQuery = (values: QueryFormValues): LogQuery => ({
  appName: values.appName?.trim() || undefined,
  level: values.level,
  from: values.range?.[0] ? formatLogTime(values.range[0]) : undefined,
  to: values.range?.[1] ? formatLogTime(values.range[1]) : undefined,
  limit: values.limit,
});

const fetchLogs = async (query: LogQuery) => {
  const queryString = buildQueryString(query);
  const params = new URLSearchParams(queryString);
  params.set('format', 'json');
  const response = await fetch(`/api/logs?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`load_failed:${response.status}`);
  }

  return (await response.json()) as LogListResponse;
};

const fetchApps = async () => {
  const response = await fetch('/api/apps?format=json');

  if (!response.ok) {
    throw new Error(`load_apps_failed:${response.status}`);
  }

  return ((await response.json()) as { apps: AppListItem[] }).apps;
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
    dataSource={logs}
    title={header ? () => header : undefined}
    columns={[
      {
        title: '应用',
        dataIndex: 'appName',
        width: 180,
      },
      {
        title: '时间',
        dataIndex: 'timestamp',
        render: (value: string) => value,
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
  const [query, setQuery] = useState<LogQuery>({});
  const [data, setData] = useState<LogListResponse>({ apps: [], logs: [], total: 0 });
  const [appOptions, setAppOptions] = useState<AppListItem[]>([]);
  const watchedValues = Form.useWatch([], form);
  const latestLoadIdRef = useRef(0);

  const load = async (nextQuery: LogQuery) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;
    setLoading(true);

    try {
      const [logs, apps] = await Promise.all([fetchLogs(nextQuery), fetchApps()]);
      if (loadId !== latestLoadIdRef.current) {
        return;
      }
      setData(logs);
      setAppOptions(apps);
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
    void load(toQuery(watchedValues ?? {}));
  }, [watchedValues]);

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
                <Form form={form} layout="inline">
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
                    <Form.Item label="级别" name="level">
                      <Select allowClear options={levelOptions} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item label="时间范围" name="range">
                      <RangePicker showTime />
                    </Form.Item>
                    <Form.Item label="条数" name="limit">
                      <InputNumber min={1} placeholder="全部" style={{ width: 120 }} />
                    </Form.Item>
                    <Button onClick={handleReset}>重置</Button>
                    <Popconfirm title="按当前筛选批量删除？" onConfirm={() => void handleDeleteMany()}>
                      <Button danger>批量删除</Button>
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
