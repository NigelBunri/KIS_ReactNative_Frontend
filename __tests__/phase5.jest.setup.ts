class MockFormData {
  _parts: Array<[string, any]>;

  constructor() {
    this._parts = [];
  }

  append(key: string, value: any) {
    this._parts.push([key, value]);
  }
}

(global as any).__DEV__ = true;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
(global as any).IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
(global as any).FormData = MockFormData;
