import { useState, useCallback } from 'react';

export function useForm(initial = {}) {
  const [values, setValues]   = useState(initial);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const set = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const onChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    set(name, type === 'checkbox' ? checked : value);
  }, [set]);

  const reset = useCallback((newValues = initial) => {
    setValues(newValues);
    setErrors({});
  }, []); // eslint-disable-line

  const setFieldError = useCallback((field, msg) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
  }, []);

  const submit = useCallback(async (handler) => {
    setLoading(true);
    try {
      await handler(values);
    } finally {
      setLoading(false);
    }
  }, [values]);

  return { values, errors, loading, set, onChange, reset, setFieldError, submit, setValues };
}
