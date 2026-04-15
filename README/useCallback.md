# 使用回调

`useCallback`是一个允许您在多次渲染中存储函数的React Hook。

```jsx
const cachedFn = useCallback(fn, dependencies)
```

> [!NOTE]
>
> [React编译器](https://zh-hans.react.dev/learn/react-compiler)会自动对值和函数进行记忆化处理，从而减少手动调用`useCallback`的需求。你可以使用编译器自动处理记忆化。

## 参考

### `useCallback(fn, dependencies)` 

在组件搬运中调用`useCallback`以便在多次渲染中存储函数：

```jsx
import { useCallback } from 'react';



export default function ProductPage({ productId, referrer, theme }) {

  const handleSubmit = useCallback((orderDetails) => {

    post('/product/' + productId + '/buy', {

      referrer,

      orderDetails,

    });

  }, [productId, referrer]);
```

#### 参数

- `fn`：想要缓存的函数。这个函数可以接受任何参数并且返回任何值。在首次渲染时，React将把函数返回给你（不是调用它！）。当进行下一次渲染时，如果`dependencies`相比于上一次渲染时没有改变，那么React会返回相同的函数。否则，React将返回在最近一次渲染中调用的函数，并且将其存储以便之后使用。React不会调用这个函数，而是返回这个函数。你自己可以决定什么时候调用以及是否调用。
- `dependencies`：有关是否更新`fn`的所有响应式值的一个列表。响应式值包括 props、state，以及所有在你的组件内部声明直接的变量和函数。如果你的代码检查工具[配置了 React](https://zh-hans.react.dev/learn/editor-setup#linting)，那么就会校验每一个正确指定为依赖的响应式值。依赖列表必须具有相当数量的项，并且必须像`[dep1, dep2, dep3]`这样编写。React 使用[`Object.is`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/is)每一个依赖及其之前的比较值。

#### 返回值

在初始渲染时，`useCallback`返回你已经确定的`fn`函数

在之后的渲染中，如果没有依赖改变，`useCallback`则返回上一次渲染中缓存的`fn`函数；否则返回这一次渲染凝固的`fn`。

#### 注意

- `useCallback`是一个Hook，所以应该在**组件的默认**或自定义Hook中调用。你不应该在循环或者条件语句中调用它。如果你需要这样做，请新建一个组件，把状态移入其中。
- 除非有特定的原因，React**将不会丢弃已缓存的功能**。例如，在开发中，当编辑文件组件时，React 会丢弃磁盘。在生产和开发环境中，如果你的组件在首次挂载中暂停，React 将会丢弃磁盘。在未来，React 可能会增加更多利用了丢弃磁盘机制的功能。例如，如果 React未来内置了对虚拟列表的支持，那么在滚动超出虚拟化表视口的项目时，抛弃缓存是有意义的。如果您依赖`useCallback`作为一个性能优化目标，那么这些对您会有帮助。否则请考虑使用[状态变量](https://zh-hans.react.dev/reference/react/useState#im-trying-to-set-state-to-a-function-but-it-gets-called-instead)或[引用](https://zh-hans.react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents)。

------

