可以。下面给一组覆盖不同 LaTeX / Markdown 数学渲染场景的公式，适合直接拿来做测试用例。

### 基础公式

$$
a+b=c
$$

$$
x^2+y^2=z^2
$$

$$
e^{i\pi}+1=0
$$

行内公式测试：\(f(x)=x^2+2x+1\)，以及 \(x\in\mathbb{R}\)。

### 分式、根号、上下标

$$
x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}
$$

$$
y=\sqrt[n]{\frac{x_1^2+x_2^2}{\alpha+\beta}}
$$

$$
a_{i,j}^{(t+1)}=\frac{\exp(s_{i,j}/\tau)}
{\sum_{k=1}^{n}\exp(s_{i,k}/\tau)}
$$

### 求和、乘积、极限

$$
\sum_{i=1}^{n} i=\frac{n(n+1)}{2}
$$

$$
\prod_{i=1}^{n}(1+x_i)
$$

$$
\lim_{x\to 0}\frac{\sin x}{x}=1
$$

$$
\lim_{n\to\infty}
\left(1+\frac{1}{n}\right)^n=e
$$

### 微积分

$$
\frac{d}{dx}f(x)
=
\lim_{h\to0}\frac{f(x+h)-f(x)}{h}
$$

$$
\frac{\partial^2 f}
{\partial x_i\,\partial x_j}
$$

$$
\int_a^b f(x)\,dx
$$

$$
\int_{-\infty}^{+\infty}
e^{-x^2}\,dx
=
\sqrt{\pi}
$$

$$
\nabla_\theta
\mathcal{L}(\theta)
=
\frac{1}{N}
\sum_{i=1}^{N}
\nabla_\theta
\ell(f_\theta(x_i),y_i)
$$

### 概率统计

$$
\mathbb{E}[X]
=
\sum_x x\,P(X=x)
$$

$$
\operatorname{Var}(X)
=
\mathbb{E}\left[(X-\mathbb{E}[X])^2\right]
$$

$$
P(A\mid B)
=
\frac{P(B\mid A)P(A)}{P(B)}
$$

$$
X\sim\mathcal{N}(\mu,\sigma^2)
$$

$$
p(x)
=
\frac{1}{\sqrt{2\pi\sigma^2}}
\exp\left(
-\frac{(x-\mu)^2}{2\sigma^2}
\right)
$$

### 向量与矩阵

$$
\mathbf{x}
=
\begin{bmatrix}
x_1\\
x_2\\
\vdots\\
x_n
\end{bmatrix}
$$

$$
A=
\begin{pmatrix}
a_{11} & a_{12} & a_{13}\\
a_{21} & a_{22} & a_{23}\\
a_{31} & a_{32} & a_{33}
\end{pmatrix}
$$

$$
A^{-1}A=AA^{-1}=I
$$

$$
\det
\begin{pmatrix}
a&b\\
c&d
\end{pmatrix}
=ad-bc
$$

$$
\|\mathbf{x}\|_2
=
\sqrt{\sum_{i=1}^{n}x_i^2}
$$

### 分段函数

$$
f(x)=
\begin{cases}
x^2, & x\ge 0,\\
-x, & x<0.
\end{cases}
$$

$$
\operatorname{ReLU}(x)
=
\max(0,x)
=
\begin{cases}
x,&x>0,\\
0,&x\le0.
\end{cases}
$$

### 优化问题

$$
\theta^\star
=
\arg\min_{\theta\in\Theta}
\mathcal{L}(\theta)
$$

$$
\begin{aligned}
\min_{\mathbf{x}}\quad
& \frac12\mathbf{x}^{\top}Q\mathbf{x}
+\mathbf{c}^{\top}\mathbf{x}\\
\text{s.t.}\quad
& A\mathbf{x}=\mathbf{b},\\
& \mathbf{x}\ge0.
\end{aligned}
$$

### Transformer / LLM

$$
\operatorname{Attention}(Q,K,V)
=
\operatorname{softmax}
\left(
\frac{QK^\top}{\sqrt{d_k}}
\right)V
$$

$$
\operatorname{softmax}(z_i)
=
\frac{e^{z_i}}
{\sum_{j=1}^{K}e^{z_j}}
$$

$$
\mathcal{L}_{\mathrm{CE}}
=
-\sum_{t=1}^{T}
\log p_\theta
\left(
x_t\mid x_{<t}
\right)
$$

$$
P(x_{1:T})
=
\prod_{t=1}^{T}
P(x_t\mid x_1,\ldots,x_{t-1})
$$

$$
h_\ell
=
h_{\ell-1}
+
\operatorname{MLP}
\left(
\operatorname{LN}(h_{\ell-1})
\right)
$$

### 信息论

$$
H(X)
=
-\sum_{x\in\mathcal{X}}
p(x)\log p(x)
$$

$$
D_{\mathrm{KL}}(P\|Q)
=
\sum_x
P(x)
\log\frac{P(x)}{Q(x)}
$$

$$
I(X;Y)
=
\sum_{x,y}
p(x,y)
\log
\frac{p(x,y)}
{p(x)p(y)}
$$

### 长公式 / 多行对齐

$$
\begin{aligned}
\mathcal{L}(\theta)
&=
\mathbb{E}_{(x,y)\sim\mathcal{D}}
\left[
-\log p_\theta(y\mid x)
\right]
+
\lambda\|\theta\|_2^2\\
&=
-\frac{1}{N}
\sum_{i=1}^{N}
\log p_\theta(y_i\mid x_i)
+
\lambda
\sum_{j=1}^{d}\theta_j^2.
\end{aligned}
$$

### 特殊符号压力测试

$$
\forall x\in\mathbb{R},
\quad
\exists\,\epsilon>0:
\quad
|x-x_0|<\delta
\Rightarrow
|f(x)-f(x_0)|<\epsilon
$$

$$
A\subseteq B,\qquad
A\cup B,\qquad
A\cap B,\qquad
A\setminus B,\qquad
A^\complement
$$

$$
\alpha,\beta,\gamma,\delta,\epsilon,\varepsilon,
\theta,\vartheta,\lambda,\mu,\sigma,\phi,\varphi,\omega,
\Gamma,\Delta,\Theta,\Lambda,\Sigma,\Phi,\Omega
$$

以及一个比较适合测复杂渲染的：

$$
\boxed{
\theta_{t+1}
=
\theta_t
-
\eta_t
\frac{
\displaystyle
\sum_{i=1}^{B}
w_i
\nabla_\theta
\log p_\theta
(y_i\mid x_i)
}{
\displaystyle
\sqrt{
\sum_{j=1}^{d}
\left(
\frac{\partial\mathcal{L}}
{\partial\theta_j}
\right)^2
+\varepsilon
}
}
}
$$
