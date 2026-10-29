# 拉格朗日乘子法

求解约束优化问题时，可以把目标函数与约束条件组合成

$$ \mathcal{L}(x,\lambda) = f(x) + \sum_{i=1}^{m}\lambda_i\,g_i(x) $$

## 一阶必要条件

在正则点处，存在 $\lambda^* \in \mathbb{R}^m$ 使得

$$ \nabla f(x^*) + \sum_{i=1}^{m}\lambda_i^* \nabla g_i(x^*) = 0, \qquad \lambda_i^* g_i(x^*)=0 $$

用矩阵形式可以写成

$$ \begin{pmatrix} H & J^{\top} \\ J & 0 \end{pmatrix}
   \begin{pmatrix} \Delta x \\ \Delta \lambda \end{pmatrix}
   = -\begin{pmatrix} \nabla f \\ g \end{pmatrix} $$

## 经典不等式

- 柯西不等式：$\left(\sum a_i b_i\right)^2 \le \left(\sum a_i^2\right)\left(\sum b_i^2\right)$
- 积分形式：$\displaystyle\int_0^1 f(x)^2\,dx \ge \left(\int_0^1 f(x)\,dx\right)^2$

| 方法 | 收敛速度 | 计算量 |
| --- | --- | --- |
| 梯度下降 | 线性 | 小 |
| 牛顿法 | 二次 | 大 |

> 摘自课件笔记：**拉格朗日对偶**与 KKT 条件。

```python
import numpy as np
x = np.linspace(0, 1, 100)
```
